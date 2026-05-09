import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge-compatible middleware — checks for a next-auth session cookie.
 * Only /control requires login. /display/* stays public.
 *
 * We check cookie presence rather than importing next-auth directly
 * because next-auth pulls in Node.js modules (stream, fs, path) which
 * aren't available in Vercel's Edge Runtime.
 */
export function middleware(request: NextRequest) {
  // next-auth sets one of these depending on http vs https
  const sessionCookie =
    request.cookies.get("next-auth.session-token") ??
    request.cookies.get("__Secure-next-auth.session-token");

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/control/:path*"],
};
