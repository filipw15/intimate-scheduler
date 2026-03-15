import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Ej autentiserad." }, { status: 401 });
  }

  const connection = await prisma.calendarConnection.findFirst({
    where: { user_id: userId },
    select: {
      id:            true,
      provider:      true,
      status:        true,
      last_synced_at: true,
      ics_url:       true,
    },
  });

  if (!connection) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected:      true,
    provider:       connection.provider,
    status:         connection.status,
    last_synced_at: connection.last_synced_at,
    // Exponera ICS-URL bara för ics_url-provider (inte OAuth-tokens)
    ics_url:        connection.provider === "ics_url" ? connection.ics_url : undefined,
  });
}
