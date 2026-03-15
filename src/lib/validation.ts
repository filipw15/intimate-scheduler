// ─── Gemensamma typer ────────────────────────────────────────────────────────

export type ValidationError = { field: string; message: string };

// ─── Tid (HH:MM) ─────────────────────────────────────────────────────────────

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

// ─── recurring_blocks ────────────────────────────────────────────────────────

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type RecurringBlock = {
  day: (typeof WEEKDAYS)[number];
  start: string;
  end: string;
  label: string;
};

export function validateRecurringBlocks(
  value: unknown
): { ok: true; data: RecurringBlock[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: "recurring_blocks måste vara en array." };
  }
  for (let i = 0; i < value.length; i++) {
    const b = value[i] as Record<string, unknown>;
    if (typeof b !== "object" || b === null) {
      return { ok: false, error: `recurring_blocks[${i}] är inte ett objekt.` };
    }
    if (!WEEKDAYS.includes(b.day as (typeof WEEKDAYS)[number])) {
      return {
        ok: false,
        error: `recurring_blocks[${i}].day är ogiltigt. Tillåtna värden: ${WEEKDAYS.join(", ")}.`,
      };
    }
    if (!isValidTime(b.start)) {
      return { ok: false, error: `recurring_blocks[${i}].start måste vara HH:MM.` };
    }
    if (!isValidTime(b.end)) {
      return { ok: false, error: `recurring_blocks[${i}].end måste vara HH:MM.` };
    }
    if (typeof b.label !== "string") {
      return { ok: false, error: `recurring_blocks[${i}].label måste vara en sträng.` };
    }
  }
  return { ok: true, data: value as RecurringBlock[] };
}

// ─── general_rules ───────────────────────────────────────────────────────────

export const VALID_RULES = [
  "no_sundays",
  "no_weekdays",
  "not_before_midnight",
] as const;

export type GeneralRule = { rule: (typeof VALID_RULES)[number] };

export function validateGeneralRules(
  value: unknown
): { ok: true; data: GeneralRule[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: "general_rules måste vara en array." };
  }
  for (let i = 0; i < value.length; i++) {
    const r = value[i] as Record<string, unknown>;
    if (typeof r !== "object" || r === null) {
      return { ok: false, error: `general_rules[${i}] är inte ett objekt.` };
    }
    if (!VALID_RULES.includes(r.rule as (typeof VALID_RULES)[number])) {
      return {
        ok: false,
        error: `general_rules[${i}].rule är ogiltigt. Tillåtna värden: ${VALID_RULES.join(", ")}.`,
      };
    }
  }
  return { ok: true, data: value as GeneralRule[] };
}

// ─── CycleData ───────────────────────────────────────────────────────────────

export type CycleDataInput = {
  last_period_start: string; // ISO date string
  cycle_length_days: number;
  period_length_days: number;
  low_interest_start_day: number;
  low_interest_end_day: number;
};

export function validateCycleData(
  body: Record<string, unknown>
): { ok: true; data: CycleDataInput } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  // last_period_start
  if (
    typeof body.last_period_start !== "string" ||
    isNaN(Date.parse(body.last_period_start))
  ) {
    errors.push({ field: "last_period_start", message: "Måste vara ett giltigt datum (YYYY-MM-DD)." });
  }

  // cycle_length_days: 21–35
  const cld = Number(body.cycle_length_days);
  if (!Number.isInteger(cld) || cld < 21 || cld > 35) {
    errors.push({ field: "cycle_length_days", message: "Måste vara ett heltal mellan 21 och 35." });
  }

  // period_length_days: 2–8
  const pld = Number(body.period_length_days);
  if (!Number.isInteger(pld) || pld < 2 || pld > 8) {
    errors.push({ field: "period_length_days", message: "Måste vara ett heltal mellan 2 och 8." });
  }

  // low_interest_start_day och end_day: 1–cycle_length_days (eller 35 om cld ogiltig)
  const maxDay = Number.isInteger(cld) && cld >= 21 && cld <= 35 ? cld : 35;
  const liStart = Number(body.low_interest_start_day);
  const liEnd = Number(body.low_interest_end_day);

  if (!Number.isInteger(liStart) || liStart < 1 || liStart > maxDay) {
    errors.push({ field: "low_interest_start_day", message: `Måste vara ett heltal mellan 1 och ${maxDay}.` });
  }
  if (!Number.isInteger(liEnd) || liEnd < 1 || liEnd > maxDay) {
    errors.push({ field: "low_interest_end_day", message: `Måste vara ett heltal mellan 1 och ${maxDay}.` });
  }
  if (errors.length === 0 && liStart > liEnd) {
    errors.push({ field: "low_interest_end_day", message: "end_day får inte vara före start_day." });
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      last_period_start: body.last_period_start as string,
      cycle_length_days: cld,
      period_length_days: pld,
      low_interest_start_day: liStart,
      low_interest_end_day: liEnd,
    },
  };
}
