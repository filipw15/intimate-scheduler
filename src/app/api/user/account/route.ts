import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearSessionCookie } from "@/lib/session";

export async function DELETE(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Ej autentiserad." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Användaren hittades inte." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // 1. Couples där användaren är user_b: dissolve så att partner ser status korrekt.
    //    user_b_id sätts till NULL automatiskt av DB (ON DELETE SET NULL) när
    //    user raderas, men vi dissolvar redan nu för partnerns skull.
    await tx.couple.updateMany({
      where: {
        user_b_id: userId,
        status: { in: ["pending", "active"] },
      },
      data: { status: "dissolved", dissolved_at: new Date() },
    });

    // 2. Couples där användaren är user_a: raderas helt (ON DELETE RESTRICT
    //    blockerar annars user-radering). Cascade tar bort proposals + subscriptions.
    await tx.couple.deleteMany({
      where: { user_a_id: userId },
    });

    // 3. Magic links kopplade till e-postadressen (har ingen user_id FK).
    await tx.magicLink.deleteMany({
      where: { email: user.email },
    });

    // 4. Radera användaren. Cascade hanterar:
    //    preferences, cycle_data, calendar_connections, availability.
    //    SET NULL hanterar user_b_id i kvarvarande couple-rader.
    await tx.user.delete({
      where: { id: userId },
    });
  });

  // 5. Rensa session-cookie
  await clearSessionCookie();

  return NextResponse.json({ message: "Kontot och all tillhörande data har raderats." });
}
