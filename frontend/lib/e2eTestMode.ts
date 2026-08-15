// Gates the test-only escape hatch that lets the e2e suite (which has no
// real inbox to read) complete the signup/password-reset email flows
// without Mailgun configured. Must never be set in .env.vercel.production
// or .env.vercel.preview — only docker-compose.yml (local/e2e only) sets it.
export function isE2ETestMode(): boolean {
  return process.env.E2E_EXPOSE_AUTH_TOKENS === "true";
}
