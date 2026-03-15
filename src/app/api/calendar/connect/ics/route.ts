import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
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

  if (typeof body.ics_url !== "string" || !body.ics_url.trim()) {
    return NextResponse.json({ error: "ics_url krävs." }, { status: 400 });
  }

  let icsUrl = body.ics_url.trim();

  // Normalisera webcal:// → https://
  if (icsUrl.startsWith("webcal://")) {
    icsUrl = "https://" + icsUrl.slice("webcal://".length);
  }

  if (!/^https?:\/\/.+/.test(icsUrl)) {
    return NextResponse.json(
      { error: "ics_url måste börja med http://, https:// eller webcal://." },
      { status: 400 }
    );
  }

  // Ersätt eventuell befintlig ICS-koppling
  const existing = await prisma.calendarConnection.findFirst({
    where: { user_id: userId, provider: "ics_url" },
    select: { id: true },
  });

  const connection = existing
    ? await prisma.calendarConnection.update({
        where:  { id: existing.id },
        data:   { ics_url: icsUrl, status: "active", last_synced_at: null },
      })
    : await prisma.calendarConnection.create({
        data: { user_id: userId, provider: "ics_url", ics_url: icsUrl, status: "active" },
      });

  return NextResponse.json({
    id:       connection.id,
    provider: connection.provider,
    ics_url:  connection.ics_url,
    status:   connection.status,
  }, { status: existing ? 200 : 201 });
}
