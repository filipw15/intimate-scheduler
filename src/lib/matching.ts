import { prisma } from "@/lib/prisma";
import { syncGoogleCalendar, syncIcsCalendar, type CalendarEvent } from "@/lib/calendar-sync";
import { isLowInterestDay } from "@/lib/cycle-calculator";
import type { CycleData, Preference } from "@prisma/client";

// ─── Tidszonshjälpare ────────────────────────────────────────────────────────

/** YYYY-MM-DD i användarens tidszon */
function localDateStr(dt: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dt);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

/** HH:MM i användarens tidszon */
function localHHMM(dt: Date, tz: string): string {
  const result = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dt);
  // Normalisera "24:00" → "00:00"
  return result === "24:00" ? "00:00" : result;
}

/** Veckodag (long, lowercase) i användarens tidszon */
function localWeekday(dt: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
  })
    .format(dt)
    .toLowerCase();
}

/** HH:MM-sträng → minuter sedan midnatt */
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** true om datum är helgdag (lördag eller söndag) i given tidszon */
function isWeekend(dt: Date, tz: string): boolean {
  const day = localWeekday(dt, tz);
  return day === "saturday" || day === "sunday";
}

// ─── Filtrera events per lokal dag ───────────────────────────────────────────

function eventsOnLocalDate(
  events: CalendarEvent[],
  targetDateStr: string,
  tz: string
): CalendarEvent[] {
  return events.filter((e) => {
    if (e.isAllDay) {
      // Heldagsevents: datum är lokalt (från kalendern)
      if (e.date === targetDateStr) return true;
      // Flerdagsevent: kontrollera om targetDate faller inom [date, endDate)
      if (e.endDate && e.date <= targetDateStr && targetDateStr < e.endDate) return true;
      return false;
    }
    if (!e.startDt) return false;
    return localDateStr(e.startDt, tz) === targetDateStr;
  });
}

// ─── 9-kriterie-evaluering ───────────────────────────────────────────────────

export type AvailabilityResult = {
  is_available: boolean;
  reason_code: string;
};

/**
 * Evaluerar tillgängligheten för en specifik kväll för en användare.
 * Alla 9 kriterier körs i ordning enligt spec sektion 6.
 */
export function evaluateDay(
  date: Date,
  allEvents: CalendarEvent[],
  pref: Preference,
  cycleData: CycleData | null,
  tz: string
): AvailabilityResult {
  const dateStr = localDateStr(date, tz);
  const tomorrowDt = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = localDateStr(tomorrowDt, tz);

  const today = eventsOnLocalDate(allEvents, dateStr, tz);
  const tomorrow = eventsOnLocalDate(allEvents, tomorrowStr, tz);

  const weekend = isWeekend(date, tz);
  const bedtime = weekend ? pref.child_bedtime_weekend : pref.child_bedtime_weekday;
  const eveningEnd = weekend ? pref.evening_end_weekend : pref.evening_end_weekday;
  const bedtimeMin = toMin(bedtime);
  const eveningEndMin = toMin(eveningEnd);

  // ── Kriterie 1: Heldagsevent idag → NO-GO (travel) ───────────────────────
  if (today.some((e) => e.isAllDay && !e.endDate)) {
    return { is_available: false, reason_code: "travel" };
  }

  // ── Kriterie 2: Flerdagsevent som täcker idag → NO-GO (travel) ───────────
  if (today.some((e) => e.isAllDay && e.endDate)) {
    return { is_available: false, reason_code: "travel" };
  }

  // ── Kriterie 3: Tidsbaserade events med platsdata → NO-GO (different_location)
  // Konservativ MVP: om något tidevent har location → tolkas som resande/annan stad
  if (today.some((e) => !e.isAllDay && e.location)) {
    return { is_available: false, reason_code: "different_location" };
  }

  // ── Kriterie 4: Events som krockar med kvällsfönstret → NO-GO (calendar_conflict)
  const hasConflict = today.some((e) => {
    if (e.isAllDay || !e.startDt) return false;
    const startMin = toMin(localHHMM(e.startDt, tz));
    const endMin = e.endDt ? toMin(localHHMM(e.endDt, tz)) : startMin + 60;
    // Event överlappar [bedtime, eveningEnd]
    return startMin < eveningEndMin && endMin > bedtimeMin;
  });
  if (hasConflict) {
    return { is_available: false, reason_code: "calendar_conflict" };
  }

  // ── Kriterie 5: Första event imorgon före 06:00 → NO-GO (early_morning) ──
  const tomorrowTimed = tomorrow.filter((e) => !e.isAllDay && e.startDt);
  if (tomorrowTimed.length > 0) {
    const earliest = tomorrowTimed
      .map((e) => toMin(localHHMM(e.startDt!, tz)))
      .sort((a, b) => a - b)[0]!;
    if (earliest < 6 * 60) {
      return { is_available: false, reason_code: "early_morning" };
    }
  }

  // ── Kriterie 6: Återkommande blockerare → NO-GO (recurring_block) ─────────
  const weekday = localWeekday(date, tz);
  const blocks = pref.recurring_blocks as Array<{
    day: string;
    start: string;
    end: string;
  }>;
  const blockHit = blocks.some((b) => {
    if (b.day.toLowerCase() !== weekday) return false;
    const bStart = toMin(b.start);
    const bEnd = toMin(b.end);
    return bStart < eveningEndMin && bEnd > bedtimeMin;
  });
  if (blockHit) {
    return { is_available: false, reason_code: "recurring_block" };
  }

  // ── Kriterie 7: Generella regler → NO-GO (general_rule) ──────────────────
  const rules = (pref.general_rules as Array<{ rule: string }>).map((r) => r.rule);

  if (rules.includes("no_sundays") && localWeekday(date, tz) === "sunday") {
    return { is_available: false, reason_code: "general_rule" };
  }
  if (rules.includes("no_weekdays") && !weekend) {
    return { is_available: false, reason_code: "general_rule" };
  }
  // "not_before_midnight" = "Inte efter midnatt" (UX-spec): kvällen får inte sträcka sig
  // förbi midnatt. Tillämpas som: NO-GO om bedtime >= 23:59.
  if (rules.includes("not_before_midnight") && bedtimeMin >= 23 * 60 + 59) {
    return { is_available: false, reason_code: "general_rule" };
  }

  // ── Kriterie 8: Menscykelns low-interest-intervall ────────────────────────
  if (cycleData && isLowInterestDay(cycleData, date)) {
    return { is_available: false, reason_code: "cycle_low_interest" };
  }

  // ── Kriterie 9: Finns ett tidsfönster? ────────────────────────────────────
  if (bedtimeMin >= eveningEndMin) {
    return { is_available: false, reason_code: "calendar_conflict" };
  }

  return { is_available: true, reason_code: "available" };
}

// ─── Publik API ───────────────────────────────────────────────────────────────

/**
 * Synkar kalender och genererar Availability-poster för ett datumintervall.
 * Upsert per (user_id, date) i databasen.
 */
export async function generateAvailabilityForRange(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  if (!user) throw new Error(`Användaren ${userId} hittades inte.`);

  const pref = await prisma.preference.findUnique({ where: { user_id: userId } });
  const cycleData = await prisma.cycleData.findUnique({ where: { user_id: userId } });
  const connection = await prisma.calendarConnection.findFirst({
    where: { user_id: userId, status: "active" },
  });

  // Hämta events en gång för hela intervallet + 1 dag (för early_morning-check)
  let events: CalendarEvent[] = [];
  if (connection) {
    try {
      events =
        connection.provider === "google"
          ? await syncGoogleCalendar(connection)
          : await syncIcsCalendar(connection);
    } catch (err) {
      console.error(`Calendar sync failed for user ${userId}:`, err);
      const msg = err instanceof Error ? err.message : String(err);
      const isExpiredToken = /invalid_grant|token.*expired|expired.*token/i.test(msg);
      await prisma.calendarConnection.update({
        where: { id: connection.id },
        data: { status: isExpiredToken ? "expired" : "error" },
      });
    }
  }

  // Iterera varje dag i intervallet
  const current = new Date(startDate);
  current.setUTCHours(12, 0, 0, 0); // Mitt på dagen för att undvika DST-kantfall

  const upserts: Promise<unknown>[] = [];

  while (current <= endDate) {
    // Om ingen preferens finns, använd GO som default (ingen info = tillgänglig)
    const result = pref
      ? evaluateDay(current, events, pref, cycleData, user.timezone)
      : { is_available: true, reason_code: "available" };

    const dateOnly = new Date(current);
    dateOnly.setUTCHours(0, 0, 0, 0);

    upserts.push(
      prisma.availability.upsert({
        where: { user_id_date: { user_id: userId, date: dateOnly } },
        update: {
          is_available: result.is_available,
          reason_code: result.reason_code,
          generated_at: new Date(),
        },
        create: {
          user_id: userId,
          date: dateOnly,
          is_available: result.is_available,
          reason_code: result.reason_code,
        },
      })
    );

    current.setUTCDate(current.getUTCDate() + 1);
  }

  await Promise.all(upserts);

  // Uppdatera last_synced_at
  if (connection) {
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: { last_synced_at: new Date() },
    });
  }
}

/**
 * Synkar och genererar Availability för en enskild dag.
 */
export async function generateAvailability(
  userId: string,
  date: Date
): Promise<AvailabilityResult> {
  await generateAvailabilityForRange(userId, date, date);

  const dateOnly = new Date(date);
  dateOnly.setUTCHours(0, 0, 0, 0);

  const row = await prisma.availability.findUnique({
    where: { user_id_date: { user_id: userId, date: dateOnly } },
  });

  return {
    is_available: row?.is_available ?? true,
    reason_code: row?.reason_code ?? "available",
  };
}
