import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findCurrentCouple } from "@/lib/couple";

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Ej autentiserad." }, { status: 401 });
  }

  const couple = await findCurrentCouple(userId);

  if (!couple) {
    return NextResponse.json({ error: "Du tillhör inget aktivt par." }, { status: 404 });
  }

  await prisma.couple.update({
    where: { id: couple.id },
    data: { status: "dissolved", dissolved_at: new Date() },
  });

  return NextResponse.json({ message: "Kopplingen har brutits." });
}
