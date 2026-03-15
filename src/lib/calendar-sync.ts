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

// ─── Native ICS parser (RFC 5545) ────────────────────────────────────────────

/** RFC 5545 line unfolding: CRLF or LF followed by a space/tab = continuation. */
function unfoldIcs(text: string): string {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

/**
 * Extract a named property from a VEVENT block.
 * Handles: DTSTART:val, DTSTART;TZID=...:val, DTSTART;VALUE=DATE:val
 */
function getIcsProp(block: string, name: string): { params: string; value: string } | null {
  const re = new RegExp(`^${name}(;[^:]*)?:(.+)$`, "mi");
  const m = block.match(re);
  if (!m) return null;
  return { params: m[1] ?? "", value: m[2]!.trim() };
}

/**
 * Parse an ICS date/datetime value.
 * Formats: YYYYMMDD (all-day), YYYYMMDDTHHMMSSZ (UTC), YYYYMMDDTHHMMSS (local → treated as UTC)
 */
function parseIcsDate(value: string, params: string): { dt: Date; isAllDay: boolean } | null {
  const allDay = params.includes("VALUE=DATE") || /^\d{8}$/.test(value);

  if (allDay) {
    if (!/^\d{8}$/.test(value)) return null;
    const dt = new Date(Date.UTC(
      parseInt(value.slice(0, 4)),
      parseInt(value.slice(4, 6)) - 1,
      parseInt(value.slice(6, 8))
    ));
    return { dt, isAllDay: true };
  }

  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!m) return null;
  const dt = new Date(Date.UTC(
    parseInt(m[1]!), parseInt(m[2]!) - 1, parseInt(m[3]!),
    parseInt(m[4]!), parseInt(m[5]!), parseInt(m[6]!)
  ));
  return { dt, isAllDay: false };
}

function parseIcs(text: string, from: Date, to: Date): CalendarEvent[] {
  const unfolded = unfoldIcs(text);
  const events: CalendarEvent[] = [];
  const veventRe = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/gi;
  let match: RegExpExecArray | null;

  while ((match = veventRe.exec(unfolded)) !== null) {
    const block = match[1]!;

    const startProp = getIcsProp(block, "DTSTART");
    if (!startProp) continue;
    const startParsed = parseIcsDate(startProp.value, startProp.params);
    if (!startParsed) continue;

    const endProp = getIcsProp(block, "DTEND");
    const endParsed = endProp ? parseIcsDate(endProp.value, endProp.params) : null;
    const endDt = endParsed?.dt ?? startParsed.dt;

    if (startParsed.dt > to) continue;
    if (endDt < from) continue;

    const locationProp = getIcsProp(block, "LOCATION");
    const location = locationProp ? extractCity(locationProp.value || null) : null;

    if (startParsed.isAllDay) {
      events.push({
        date:     startParsed.dt.toISOString().slice(0, 10),
        endDate:  endDt.toISOString().slice(0, 10),
        startDt:  null,
        endDt:    null,
        location,
        isAllDay: true,
      });
    } else {
      events.push({
        date:     startParsed.dt.toISOString().slice(0, 10),
        endDate:  null,
        startDt:  startParsed.dt,
        endDt,
        location,
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

  const res = await fetch(connection.ics_url);
  if (!res.ok) {
    throw new Error(`ICS fetch misslyckades (${res.status})`);
  }
  const text = await res.text();

  const now = new Date();
  const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  return parseIcs(text, now, in15Days);
}
