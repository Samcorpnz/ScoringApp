import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const relayUrl = process.env.NEXT_PUBLIC_RELAY_URL;

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    integrations: [Sentry.browserTracingIntegration()],
    // Default targets are same-origin only; the control/display pages talk
    // to the relay on a different origin, so it needs to be added explicitly
    // for trace headers to propagate across that boundary.
    tracePropagationTargets: ["localhost", /^\//, ...(relayUrl ? [relayUrl] : [])],
  });
}
