import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Ej autentiserad." }, { status: 401 });
  }

  const connection = await prisma.calendarConnection.findFirst({
    where: { user_id: userId },
    select: { id: true },
  });

  if (!connection) {
    return NextResponse.json({ error: "Ingen kalenderanslutning hittades." }, { status: 404 });
  }

  // Ta bort anslutning och all tillhörande Availability i en transaktion
  await prisma.$transaction([
    prisma.availability.deleteMany({ where: { user_id: userId } }),
    prisma.calendarConnection.delete({ where: { id: connection.id } }),
  ]);

  return NextResponse.json({ message: "Kalenderanslutning borttagen." });
}
