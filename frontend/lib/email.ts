import { Resend } from "resend";

// Lazily constructed, mirroring lib/stripe.ts's getStripe() — importing this
// module during Next.js's build-time page-data collection shouldn't throw
// in environments where Resend isn't configured yet. The error only
// surfaces when a route that actually sends mail runs.
const globalForResend = globalThis as unknown as { resend?: Resend };

function getResend(): Resend {
  if (globalForResend.resend) return globalForResend.resend;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  const client = new Resend(apiKey);
  if (process.env.NODE_ENV !== "production") {
    globalForResend.resend = client;
  }
  return client;
}

export async function sendEmailChangeVerification({ to, token }: { to: string; token: string }): Promise<void> {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM is not configured");
  }
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/verify-email?token=${token}`;

  await getResend().emails.send({
    from,
    to,
    subject: "Confirm your new ScoreHub email address",
    text: `Click the link below to confirm this is your new email address for ScoreHub.\n\n${link}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
    html: `<p>Click the link below to confirm this is your new email address for ScoreHub.</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
  });
}
