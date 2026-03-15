import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { findCurrentCouple } from "@/lib/couple";
import { sendInviteEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Ej autentiserad." }, { status: 401 });
  }

  let partnerEmail: string;
  try {
    const body = await req.json() as { partner_email?: unknown };
    if (typeof body.partner_email !== "string" || !body.partner_email.includes("@")) {
      return NextResponse.json({ error: "Ogiltig e-postadress." }, { status: 400 });
    }
    partnerEmail = body.partner_email.toLowerCase().trim();
  } catch {
    return NextResponse.json({ error: "Ogiltigt format." }, { status: 400 });
  }

  const inviter = await prisma.user.findUnique({ where: { id: userId } });
  if (!inviter) {
    return NextResponse.json({ error: "Användaren hittades inte." }, { status: 404 });
  }

  if (inviter.email === partnerEmail) {
    return NextResponse.json({ error: "Du kan inte bjuda in dig själv." }, { status: 400 });
  }

  const existing = await findCurrentCouple(userId);
  if (existing) {
    return NextResponse.json(
      { error: "Du är redan del av ett aktivt par." },
      { status: 409 }
    );
  }

  const invite_token = randomBytes(32).toString("hex");

  const couple = await prisma.couple.create({
    data: {
      user_a_id: userId,
      invite_token,
      status: "pending",
    },
  });

  try {
    await sendInviteEmail(partnerEmail, inviter.display_name, invite_token);
  } catch (err) {
    console.error("Failed to send invite email:", err);
  }

  return NextResponse.json({ couple_id: couple.id, invite_token }, { status: 201 });
}
