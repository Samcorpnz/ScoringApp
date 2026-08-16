import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { isRateLimited, clientIp } from "@/lib/rateLimit";
import { createChallenge, rpID } from "@/lib/webauthn";

// Deliberately unauthenticated — this is the login-time endpoint. Empty
// allowCredentials makes this a usernameless/discoverable-credential
// ceremony: the browser/OS presents whichever resident passkeys it holds
// for this rpID, rather than the caller telling it which account to use.
export async function POST(req: NextRequest) {
  if (isRateLimited(`webauthn-auth-options:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    userVerification: "preferred",
    allowCredentials: [],
  });

  await createChallenge(options.challenge, "authentication", null);

  return NextResponse.json(options);
}
