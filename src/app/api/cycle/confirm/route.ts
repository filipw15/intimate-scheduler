import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Ej autentiserad." }, { status: 401 });
  }

  const existing = await prisma.cycleData.findUnique({ where: { user_id: userId } });
  if (!existing) {
    return NextResponse.json(
      { error: "Ingen cykeldata finns. Lägg till data med PUT /api/cycle först." },
      { status: 404 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Ogiltigt JSON." }, { status: 400 });
  }

  // as_expected: true → nästa cykel börjar som beräknat (inget att göra)
  // as_expected: false + actual_start → uppdatera last_period_start med faktiskt datum
  const { as_expected, actual_start } = body;

  if (typeof as_expected !== "boolean") {
    return NextResponse.json(
      { error: "Fältet as_expected (boolean) krävs." },
      { status: 400 }
    );
  }

  if (as_expected) {
    // Skjut fram last_period_start med en cykel
    const next = new Date(existing.last_period_start);
    next.setDate(next.getDate() + existing.cycle_length_days);
    const updated = await prisma.cycleData.update({
      where: { user_id: userId },
      data:  { last_period_start: next },
    });
    return NextResponse.json(updated);
  }

  // Faktiskt datum angivet
  if (typeof actual_start !== "string" || isNaN(Date.parse(actual_start))) {
    return NextResponse.json(
      { error: "actual_start måste vara ett giltigt datum (YYYY-MM-DD) när as_expected är false." },
      { status: 400 }
    );
  }

  const updated = await prisma.cycleData.update({
    where: { user_id: userId },
    data:  { last_period_start: new Date(actual_start) },
  });

  return NextResponse.json(updated);
}
