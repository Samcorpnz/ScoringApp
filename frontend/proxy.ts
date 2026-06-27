import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { loginRedirectUrl } from "@/lib/authRedirect";

// Server-enforced auth gate for /control — the page itself only does a
// client-side useSession() redirect, which is a UX nicety, not a security
// boundary (SA-4). This runs before any page code (or its data-fetching
// hooks) executes.
export default auth((req) => {
  const redirectUrl = loginRedirectUrl(req);
  return redirectUrl ? NextResponse.redirect(redirectUrl) : undefined;
});

export const config = {
  matcher: ["/control", "/control/:path*"],
};
