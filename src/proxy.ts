import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

// Routes som är öppna utan inloggning
const PUBLIC_PATHS = [
  /^\/$/,                              // Landing/login-sida
  /^\/invite\//,                       // Inbjudningssida (frontend)
  /^\/api\/auth\//,                    // Magic link + verify + logout
  /^\/api\/couple\/invite\/[^/]+$/,    // GET inbjudningsinfo (öppen)
  /^\/api\/calendar\/callback\//,      // OAuth callback (identifieras via state-JWT)
  /^\/api\/proposals\/respond\//,      // One-click svar via e-postlänk
  /^\/api\/webcal\//,                  // ICS-prenumeration
  /^\/api\/health$/,                   // Health check
  /^\/_next\//,                        // Next.js internals
  /^\/favicon\.ico$/,
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((pattern) => pattern.test(pathname));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(req);

  if (!session) {
    // API-routes returnerar 401, sidor redirectar till login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Ej autentiserad." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Vidarebefordra userId i header så att route handlers slipper verifiera igen
  const headers = new Headers(req.headers);
  headers.set("x-user-id", session.userId);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
