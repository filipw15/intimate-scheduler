import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const couple = await prisma.couple.findUnique({
    where: { invite_token: token },
    include: { user_a: { select: { display_name: true } } },
  });

  if (!couple) {
    return NextResponse.json({ error: "Inbjudan hittades inte." }, { status: 404 });
  }

  if (couple.status === "dissolved") {
    return NextResponse.json({ error: "Inbjudan är inte längre giltig." }, { status: 410 });
  }

  return NextResponse.json({
    inviter_name: couple.user_a.display_name,
    status: couple.status,
  });
}
