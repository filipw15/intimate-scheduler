import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3200";

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Ej autentiserad." }, { status: 401 });
  }

  const couple = await prisma.couple.findFirst({
    where: {
      OR: [{ user_a_id: userId }, { user_b_id: userId }],
      status: "active",
    },
    select: {
      id: true,
      calendar_subscriptions: {
        where: { user_id: userId },
        select: { webcal_token: true },
      },
    },
  });

  if (!couple) {
    return NextResponse.json(
      { error: "Inget aktivt par hittades." },
      { status: 404 }
    );
  }

  // Returnera befintlig prenumeration om den redan finns för denna användare
  const existing = couple.calendar_subscriptions[0];
  if (existing) {
    const token = existing.webcal_token;
    return NextResponse.json({
      webcal_url: `webcal://${BASE_URL.replace(/^https?:\/\//, "")}/api/webcal/${token}`,
      https_url: `${BASE_URL}/api/webcal/${token}`,
    });
  }

  // Skapa ny prenumeration för denna användare
  const webcalToken = crypto.randomBytes(32).toString("hex");
  await prisma.calendarSubscription.create({
    data: {
      user_id: userId,
      couple_id: couple.id,
      webcal_token: webcalToken,
    },
  });

  return NextResponse.json(
    {
      webcal_url: `webcal://${BASE_URL.replace(/^https?:\/\//, "")}/api/webcal/${webcalToken}`,
      https_url: `${BASE_URL}/api/webcal/${webcalToken}`,
    },
    { status: 201 }
  );
}
