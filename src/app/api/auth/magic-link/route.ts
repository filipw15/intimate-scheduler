import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendMagicLinkEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  let email: string;
  try {
    const body = await req.json() as { email?: unknown };
    if (typeof body.email !== "string" || !body.email.includes("@")) {
      return NextResponse.json({ error: "Ogiltig e-postadress." }, { status: 400 });
    }
    email = body.email.toLowerCase().trim();
  } catch {
    return NextResponse.json({ error: "Ogiltigt format." }, { status: 400 });
  }

  // Upsert user — skapa om de inte finns
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      display_name: email.split("@")[0] ?? email,
      codename: "",
    },
  });

  const token = randomBytes(32).toString("hex");
  const expires_at = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.magicLink.create({
    data: { email, token, expires_at },
  });

  try {
    await sendMagicLinkEmail(email, token);
  } catch (err) {
    console.error("Failed to send magic link email:", err);
    // Returnera alltid samma svar för att inte läcka om adressen finns
  }

  // Alltid samma svar oavsett om mejlet skickades (skyddar mot enumeration)
  return NextResponse.json({ message: "Om adressen finns skickas en inloggningslänk inom kort." });
}
