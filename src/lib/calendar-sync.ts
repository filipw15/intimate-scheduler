import * as ical from "node-ical";
import { decrypt } from "@/lib/encryption";
import type { CalendarConnection } from "@prisma/client";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3200";

// ─── Typer ───────────────────────────────────────────────────────────────────

export type CalendarEvent = {
  /** YYYY-MM-DD i UTC (startdatum). För heldagsevents: det lokala datumet. */
  date: string;
  /** YYYY-MM-DD i UTC (slutdatum, exklusivt, för heldagsevents). Null för timevents. */
  endDate: string | null;
  /** Fullständigt UTC-datum för start. Null för heldagsevents. */
  startDt: Date | null;
  /** Fullständigt UTC-datum för slut. Null för heldagsevents. */
  endDt: Date | null;
  location: string | null;
  isAllDay: boolean;
};

// ─── Hjälpfunktioner ─────────────────────────────────────────────────────────

/** node-ical returnerar location som string | { val: string } | undefined */
function resolveLocation(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw || null;
  if (typeof raw === "object" && "val" in (raw as object)) {
    return String((raw as { val: unknown }).val) || null;
  }
  return null;
}

/**
 * Enkel stadsextraktion ur location-strängar.
 * "Storgatan 1, Stockholm, Sweden" → "Stockholm"
 * "New York, NY 10001, USA" → "New York"
 * "Stockholm" → "Stockholm"
 */
function extractCity(location: string | null | undefined): string | null {
  if (!location?.trim()) return null;
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 100);
  const candidate = parts.length >= 3 ? parts[parts.length - 2]! : parts[0]!;
  return candidate.replace(/^\w{2}\s+\d+$/, "").trim().slice(0, 100) || null;
}

// ─── Google OAuth (native fetch, no googleapis package) ───────────────────────

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri:  `${BASE_URL}/api/calendar/callback/google`,
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/calendar.readonly",
    access_type:   "offline",
    prompt:        "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(
  code: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri:  `${BASE_URL}/api/calendar/callback/google`,
      grant_type:    "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange misslyckades (${res.status}): ${err}`);
  }

  const data = await res.json() as { access_token?: string; refresh_token?: string };
  if (!data.access_token) throw new Error("Inget access_token från Google.");
  if (!data.refresh_token) throw new Error("Inget refresh_token från Google. Återkalla appens åtkomst och försök igen.");
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type:    "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}) as Record<string, unknown>) as { error?: string };
    // invalid_grant = token revoked or expired beyond refresh
    throw new Error(err.error === "invalid_grant" ? "invalid_grant" : `Token refresh misslyckades: ${res.status}`);
  }

  const data = await res.json() as { access_token?: string };
  if (!data.access_token) throw new Error("Inget access_token vid token refresh.");
  return data.access_token;
}

export async function syncGoogleCalendar(
  connection: CalendarConnection
): Promise<CalendarEvent[]> {
  if (!connection.oauth_token || !connection.refresh_token) {
    throw new Error("Saknar tokens för Google Calendar.");
  }

  let accessToken = decrypt(connection.oauth_token);
  const refreshToken = decrypt(connection.refresh_token);

  const now = new Date();
  const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin:      now.toISOString(),
    timeMax:      in15Days.toISOString(),
    singleEvents: "true",
    orderBy:      "startTime",
    maxResults:   "250",
    fields:       "items(start,end,location)",
  });

  const fetchEvents = (token: string) =>
    fetch(`${GOOGLE_CALENDAR_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  let res = await fetchEvents(accessToken);

  // Access token expired → refresh and retry once
  if (res.status === 401) {
    accessToken = await refreshGoogleAccessToken(refreshToken);
    res = await fetchEvents(accessToken);
  }

  if (!res.ok) {
    throw new Error(`Google Calendar API returnerade ${res.status}`);
  }

  type GItem = {
    start?: { date?: string; dateTime?: string };
    end?:   { date?: string; dateTime?: string };
    location?: string;
  };
  const data = await res.json() as { items?: GItem[] };
  const events: CalendarEvent[] = [];

  for (const item of data.items ?? []) {
    if (!item.start) continue;

    const isAllDay = Boolean(item.start.date && !item.start.dateTime);

    if (isAllDay) {
      events.push({
        date:     item.start.date!,
        endDate:  item.end?.date ?? null,
        startDt:  null,
        endDt:    null,
        location: extractCity(item.location),
        isAllDay: true,
      });
    } else {
      const startDt = new Date(item.start.dateTime!);
      const endDt   = item.end?.dateTime ? new Date(item.end.dateTime) : startDt;
      events.push({
        date:     startDt.toISOString().slice(0, 10),
        endDate:  null,
        startDt,
        endDt,
        location: extractCity(item.location),
        isAllDay: false,
      });
    }
  }

  return events;
}

// ─── ICS ─────────────────────────────────────────────────────────────────────

export async function syncIcsCalendar(
  connection: CalendarConnection
): Promise<CalendarEvent[]> {
  if (!connection.ics_url) {
    throw new Error("Saknar ICS-URL.");
  }

  const data = await ical.async.fromURL(connection.ics_url);
  const now = new Date();
  const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const events: CalendarEvent[] = [];

  for (const raw of Object.values(data)) {
    if (!raw || raw.type !== "VEVENT") continue;
    const component = raw as ical.VEvent;

    const startRaw = component.start;
    const endRaw   = component.end;
    if (!startRaw) continue;

    const startDt = startRaw instanceof Date ? startRaw : new Date(startRaw);
    if (isNaN(startDt.getTime())) continue;
    if (startDt > in15Days) continue;

    const endDtRaw = endRaw ? (endRaw instanceof Date ? endRaw : new Date(endRaw)) : startDt;
    if (endDtRaw < now) continue;

    const isAllDay = (component as unknown as { datetype?: string }).datetype === "date";

    if (isAllDay) {
      events.push({
        date:     startDt.toISOString().slice(0, 10),
        endDate:  endDtRaw.toISOString().slice(0, 10),
        startDt:  null,
        endDt:    null,
        location: extractCity(resolveLocation(component.location)),
        isAllDay: true,
      });
    } else {
      events.push({
        date:     startDt.toISOString().slice(0, 10),
        endDate:  null,
        startDt,
        endDt:    endDtRaw,
        location: extractCity(resolveLocation(component.location)),
        isAllDay: false,
      });
    }
  }

  return events;
}
