import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findCurrentCouple } from "@/lib/couple";
import { generateWeeklyProposals } from "@/lib/proposal-generator";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Ej autentiserad." }, { status: 401 });
  }

  const { token } = await params;

  const couple = await prisma.couple.findUnique({
    where: { invite_token: token },
  });

  if (!couple) {
    return NextResponse.json({ error: "Inbjudan hittades inte." }, { status: 404 });
  }

  if (couple.status !== "pending") {
    return NextResponse.json({ error: "Inbjudan är inte längre giltig." }, { status: 409 });
  }

  if (couple.user_a_id === userId) {
    return NextResponse.json({ error: "Du kan inte acceptera din egen inbjudan." }, { status: 400 });
  }

  const existing = await findCurrentCouple(userId);
  if (existing) {
    return NextResponse.json(
      { error: "Du är redan del av ett aktivt par." },
      { status: 409 }
    );
  }

  const updated = await prisma.couple.update({
    where: { id: couple.id },
    data: { user_b_id: userId, status: "active" },
    include: {
      user_a: { select: { display_name: true } },
      user_b: { select: { display_name: true } },
    },
  });

  // Trigga proposal-generering direkt — fire-and-forget
  generateWeeklyProposals(updated.id)
    .then((n) => console.log(`[accept] Par ${updated.id}: ${n} förslag genererade direkt.`))
    .catch((err) => console.error(`[accept] Proposal-generering misslyckades för par ${updated.id}:`, err));

  return NextResponse.json({
    couple_id: updated.id,
    status: updated.status,
    partner_name: updated.user_a.display_name,
  });
}
