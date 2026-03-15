import { google } from "googleapis";
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

// ─── Google Calendar ──────────────────────────────────────────────────────────

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${BASE_URL}/api/calendar/callback/google`
  );
}

export function getGoogleAuthUrl(state: string): string {
  const oauth2 = createOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
    state,
  });
}

export async function exchangeGoogleCode(
  code: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const oauth2 = createOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.access_token) throw new Error("Inget access_token från Google.");
  if (!tokens.refresh_token) throw new Error("Inget refresh_token från Google. Revoke app access och försök igen.");
  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
}

export async function syncGoogleCalendar(
  connection: CalendarConnection
): Promise<CalendarEvent[]> {
  if (!connection.oauth_token || !connection.refresh_token) {
    throw new Error("Saknar tokens för Google Calendar.");
  }

  const accessToken = decrypt(connection.oauth_token);
  const refreshToken = decrypt(connection.refresh_token);

  const oauth2 = createOAuth2Client();
  oauth2.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  const now = new Date();
  const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // +1 för tomorrow-check

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: in15Days.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
    fields: "items(start,end,location)", // Kasserar namn, beskrivning, deltagare
  });

  const events: CalendarEvent[] = [];

  for (const item of response.data.items ?? []) {
    if (!item.start) continue;

    const isAllDay = Boolean(item.start.date && !item.start.dateTime);

    if (isAllDay) {
      events.push({
        date: item.start.date!,
        endDate: item.end?.date ?? null,  // Exklusivt slutdatum för flerdagsevent
        startDt: null,
        endDt: null,
        location: extractCity(item.location),
        isAllDay: true,
      });
    } else {
      const startDt = new Date(item.start.dateTime!);
      const endDt = item.end?.dateTime ? new Date(item.end.dateTime) : startDt;
      events.push({
        date: startDt.toISOString().slice(0, 10),
        endDate: null,
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
    const endRaw = component.end;
    if (!startRaw) continue;

    const startDt = startRaw instanceof Date ? startRaw : new Date(startRaw);
    if (isNaN(startDt.getTime())) continue;
    if (startDt > in15Days) continue;

    const endDtRaw = endRaw ? (endRaw instanceof Date ? endRaw : new Date(endRaw)) : startDt;
    if (endDtRaw < now) continue;

    const isAllDay = (component as unknown as { datetype?: string }).datetype === "date";

    if (isAllDay) {
      events.push({
        date: startDt.toISOString().slice(0, 10),
        endDate: endDtRaw.toISOString().slice(0, 10),
        startDt: null,
        endDt: null,
        location: extractCity(resolveLocation(component.location)),
        isAllDay: true,
      });
    } else {
      events.push({
        date: startDt.toISOString().slice(0, 10),
        endDate: null,
        startDt,
        endDt: endDtRaw,
        location: extractCity(resolveLocation(component.location)),
        isAllDay: false,
      });
    }
  }

  return events;
}
