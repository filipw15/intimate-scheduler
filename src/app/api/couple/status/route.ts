import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findCurrentCouple } from "@/lib/couple";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Ej autentiserad." }, { status: 401 });
  }

  const couple = await findCurrentCouple(userId);

  if (!couple) {
    return NextResponse.json({ coupled: false });
  }

  const partnerId =
    couple.user_a_id === userId ? couple.user_b_id : couple.user_a_id;

  const partner = partnerId
    ? await prisma.user.findUnique({
        where: { id: partnerId },
        select: { display_name: true },
      })
    : null;

  return NextResponse.json({
    coupled: true,
    couple_id: couple.id,
    status: couple.status,
    partner_name: partner?.display_name ?? null,
  });
}
