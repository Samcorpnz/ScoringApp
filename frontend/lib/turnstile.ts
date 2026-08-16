// Server-side Cloudflare Turnstile verification for public, unauthenticated
// endpoints that send email (signup, forgot-password) — mitigates
// email-bombing via scripted submission. Mirrors lib/stripe.ts/lib/email.ts's
// pattern of no-op'ing when unconfigured (local dev / self-hosted deploys
// without TURNSTILE_SECRET set), rather than hard-failing.
export async function verifyTurnstileToken(token: string, remoteip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true;
  if (!token) return false;

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token, remoteip }),
  });
  const data = await res.json().catch(() => null);
  return data?.success === true;
}
