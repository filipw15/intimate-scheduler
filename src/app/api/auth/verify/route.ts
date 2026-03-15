import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/?error=invalid_token", req.url));
  }

  const magicLink = await prisma.magicLink.findUnique({ where: { token } });

  if (!magicLink) {
    return NextResponse.redirect(new URL("/?error=invalid_token", req.url));
  }

  if (magicLink.used) {
    return NextResponse.redirect(new URL("/?error=already_used", req.url));
  }

  if (magicLink.expires_at < new Date()) {
    return NextResponse.redirect(new URL("/?error=expired", req.url));
  }

  // Markera som använd
  await prisma.magicLink.update({
    where: { token },
    data: { used: true },
  });

  const user = await prisma.user.findUnique({ where: { email: magicLink.email } });
  if (!user) {
    return NextResponse.redirect(new URL("/?error=user_not_found", req.url));
  }

  await setSessionCookie(user.id);

  return NextResponse.redirect(new URL("/", req.url));
}
