// Pulled out of proxy.ts so this pure redirect decision can be unit tested
// without pulling next-auth (and its next/server import) into the test
// module graph (SA-7).
export function loginRedirectUrl(req: { auth: { user?: unknown } | null; nextUrl: URL }): URL | null {
  if (req.auth?.user) return null;
  const loginUrl = new URL("/login", req.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
  return loginUrl;
}
