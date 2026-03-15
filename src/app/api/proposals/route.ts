import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Ej autentiserad." }, { status: 401 });
  }

  const couple = await prisma.couple.findFirst({
    where: {
      OR: [{ user_a_id: userId }, { user_b_id: userId }],
      status: "active",
    },
    select: { id: true, user_a_id: true },
  });

  if (!couple) {
    return NextResponse.json({ proposals: [] });
  }

  const isUserA = couple.user_a_id === userId;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const proposals = await prisma.proposal.findMany({
    where: {
      couple_id: couple.id,
      OR: [
        { status: "pending" },
        { status: "accepted", resolved_at: { gte: thirtyDaysAgo } },
      ],
    },
    select: {
      id: true,
      proposed_date: true,
      proposed_time: true,
      status: true,
      user_a_response: true,
      user_b_response: true,
      expires_at: true,
    },
    orderBy: { proposed_date: "asc" },
  });

  const result = proposals.map((p) => ({
    id: p.id,
    proposed_date: p.proposed_date,
    proposed_time: p.proposed_time,
    status: p.status,
    my_response: isUserA ? p.user_a_response : p.user_b_response,
    expires_at: p.expires_at,
  }));

  return NextResponse.json({ proposals: result });
}
