import type { CycleData } from "@prisma/client";

/**
 * Räknar ut om ett givet datum faller inom low_interest-intervallet
 * för en menscykel. Cykeln upprepar sig från last_period_start.
 *
 * @param cycleData  Användarens cykeldata
 * @param date       Det datum som ska evalueras (lokal dag)
 * @returns          true om datumet är ett low-interest-dag
 */
export function isLowInterestDay(cycleData: CycleData, date: Date): boolean {
  const periodStart = new Date(cycleData.last_period_start);
  // Jämför på dagnivå i UTC
  periodStart.setUTCHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setUTCHours(0, 0, 0, 0);

  const diffMs = target.getTime() - periodStart.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  // Datum före senaste periodstart → inte i current cycle window
  if (diffDays < 0) return false;

  // Dag i cykeln (1-indexerad)
  const cycleDay = (diffDays % cycleData.cycle_length_days) + 1;

  return (
    cycleDay >= cycleData.low_interest_start_day &&
    cycleDay <= cycleData.low_interest_end_day
  );
}
