import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateCycleData } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Ej autentiserad." }, { status: 401 });
  }

  const cycle = await prisma.cycleData.findUnique({ where: { user_id: userId } });
  return NextResponse.json(cycle ?? null);
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

  const result = validateCycleData(body);
  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }

  const { last_period_start, ...rest } = result.data;

  const cycle = await prisma.cycleData.upsert({
    where:  { user_id: userId },
    update: { last_period_start: new Date(last_period_start), ...rest },
    create: { user_id: userId, last_period_start: new Date(last_period_start), ...rest },
  });

  return NextResponse.json(cycle);
}
