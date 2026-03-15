import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isValidTime,
  validateRecurringBlocks,
  validateGeneralRules,
} from "@/lib/validation";

const DEFAULTS = {
  child_bedtime_weekday: "20:00",
  child_bedtime_weekend: "20:30",
  evening_end_weekday: "23:00",
  evening_end_weekend: "23:30",
  recurring_blocks: [],
  general_rules: [],
} as const;

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Ej autentiserad." }, { status: 401 });
  }

  const pref = await prisma.preference.findUnique({ where: { user_id: userId } });

  if (!pref) {
    return NextResponse.json({ ...DEFAULTS, user_id: userId, exists: false });
  }

  return NextResponse.json({ ...pref, exists: true });
}

export async function PUT(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Ej autentiserad." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Ogiltigt JSON." }, { status: 400 });
  }

  // Hämta befintlig för merge av defaults
  const existing = await prisma.preference.findUnique({ where: { user_id: userId } });

  const child_bedtime_weekday = body.child_bedtime_weekday ?? existing?.child_bedtime_weekday ?? DEFAULTS.child_bedtime_weekday;
  const child_bedtime_weekend = body.child_bedtime_weekend ?? existing?.child_bedtime_weekend ?? DEFAULTS.child_bedtime_weekend;
  const evening_end_weekday   = body.evening_end_weekday   ?? existing?.evening_end_weekday   ?? DEFAULTS.evening_end_weekday;
  const evening_end_weekend   = body.evening_end_weekend   ?? existing?.evening_end_weekend   ?? DEFAULTS.evening_end_weekend;

  // Validera tider
  for (const [field, value] of [
    ["child_bedtime_weekday", child_bedtime_weekday],
    ["child_bedtime_weekend", child_bedtime_weekend],
    ["evening_end_weekday",   evening_end_weekday],
    ["evening_end_weekend",   evening_end_weekend],
  ] as const) {
    if (!isValidTime(value)) {
      return NextResponse.json(
        { error: `${field} måste vara ett giltigt klockslag (HH:MM).` },
        { status: 400 }
      );
    }
  }

  // Validera recurring_blocks
  const blocksRaw = body.recurring_blocks ?? existing?.recurring_blocks ?? DEFAULTS.recurring_blocks;
  const blocksResult = validateRecurringBlocks(blocksRaw);
  if (!blocksResult.ok) {
    return NextResponse.json({ error: blocksResult.error }, { status: 400 });
  }

  // Validera general_rules
  const rulesRaw = body.general_rules ?? existing?.general_rules ?? DEFAULTS.general_rules;
  const rulesResult = validateGeneralRules(rulesRaw);
  if (!rulesResult.ok) {
    return NextResponse.json({ error: rulesResult.error }, { status: 400 });
  }

  const data = {
    child_bedtime_weekday: child_bedtime_weekday as string,
    child_bedtime_weekend: child_bedtime_weekend as string,
    evening_end_weekday:   evening_end_weekday as string,
    evening_end_weekend:   evening_end_weekend as string,
    recurring_blocks: blocksResult.data,
    general_rules:    rulesResult.data,
  };

  const pref = await prisma.preference.upsert({
    where:  { user_id: userId },
    update: data,
    create: { user_id: userId, ...data },
  });

  return NextResponse.json(pref);
}
