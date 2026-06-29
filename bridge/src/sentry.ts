import * as Sentry from "@sentry/node";

// SA-88: once packaged as an Electron desktop app, the bridge runs on a
// customer's own machine with no way to set environment variables, so the
// DSN must be baked in at build time. SENTRY_DSN still overrides it for
// local dev or anyone self-hosting the bridge from source.
const BUILT_IN_SENTRY_DSN =
  "https://24a6c1c9e267b798ce1951914513516e@o4511472183476224.ingest.us.sentry.io/4511640908464138";

const dsn = process.env.SENTRY_DSN || BUILT_IN_SENTRY_DSN;
let initialized = false;

export function initSentry(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
  });
  initialized = true;
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

export function captureMessage(msg: string): void {
  if (!initialized) return;
  Sentry.captureMessage(msg, "error");
}
