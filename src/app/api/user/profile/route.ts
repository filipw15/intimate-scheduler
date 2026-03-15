import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TONE_PREFS = ["playful", "discreet", "direct"] as const;
type TonePref = (typeof TONE_PREFS)[number];

function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string") return false;
  try {
    Intl.supportedValuesOf("timeZone").includes(tz);
    // Verifiera att zonen faktiskt fungerar
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Ej autentiserad." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      display_name: true,
      tone_pref: true,
      codename: true,
      timezone: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Användaren hittades inte." }, { status: 404 });
  }

  return NextResponse.json(user);
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

  const update: Record<string, unknown> = {};

  if ("display_name" in body) {
    if (typeof body.display_name !== "string" || body.display_name.trim() === "") {
      return NextResponse.json(
        { error: "display_name måste vara en icke-tom sträng." },
        { status: 400 }
      );
    }
    update.display_name = body.display_name.trim();
  }

  if ("tone_pref" in body) {
    if (!TONE_PREFS.includes(body.tone_pref as TonePref)) {
      return NextResponse.json(
        { error: `tone_pref måste vara ett av: ${TONE_PREFS.join(", ")}.` },
        { status: 400 }
      );
    }
    update.tone_pref = body.tone_pref as TonePref;
  }

  if ("codename" in body) {
    if (typeof body.codename !== "string") {
      return NextResponse.json(
        { error: "codename måste vara en sträng." },
        { status: 400 }
      );
    }
    update.codename = body.codename.trim();
  }

  if ("timezone" in body) {
    if (!isValidTimezone(body.timezone)) {
      return NextResponse.json(
        { error: "timezone är inte en giltig IANA-tidszon (t.ex. 'Europe/Stockholm')." },
        { status: 400 }
      );
    }
    update.timezone = body.timezone;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Inga giltiga fält att uppdatera." },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: update,
    select: {
      id: true,
      email: true,
      display_name: true,
      tone_pref: true,
      codename: true,
      timezone: true,
    },
  });

  return NextResponse.json(user);
}
