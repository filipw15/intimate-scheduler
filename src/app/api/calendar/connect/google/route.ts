import { NextRequest, NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauth-state";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Ej autentiserad." }, { status: 401 });
  }

  const state = await createOAuthState(userId);
  // Lazy import to avoid googleapis BigInt error at build time
  const { getGoogleAuthUrl } = await import("@/lib/calendar-sync");
  const authUrl = getGoogleAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
