import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/session";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3200";

function redirect(path: string) {
  return NextResponse.redirect(`${BASE_URL}${path}`);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return redirect("/?error=invalid_token");
  }

  const magicLink = await prisma.magicLink.findUnique({ where: { token } });

  if (!magicLink) {
    return redirect("/?error=invalid_token");
  }

  if (magicLink.used) {
    return redirect("/?error=already_used");
  }

  if (magicLink.expires_at < new Date()) {
    return redirect("/?error=expired");
  }

  await prisma.magicLink.update({
    where: { token },
    data: { used: true },
  });

  const user = await prisma.user.findUnique({ where: { email: magicLink.email } });
  if (!user) {
    return redirect("/?error=user_not_found");
  }

  await setSessionCookie(user.id);

  return redirect("/");
}
