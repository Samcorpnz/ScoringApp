import { Logtail } from "@logtail/node";

// Ships structured logs directly to Better Stack from app code (an HTTP
// call per log line) rather than a platform-level Fly.io log drain — the
// drain path needs a second standalone Fly app just to ship logs, which
// isn't worth the extra infra for this. No-op (console only) until
// BETTER_STACK_SOURCE_TOKEN is set, same fallback pattern as sentry.ts.
// Same env var names as frontend's @logtail/next config (BETTER_STACK_*),
// for one consistent secret name across both deployables.
const token = process.env.BETTER_STACK_SOURCE_TOKEN;
const ingestingUrl = process.env.BETTER_STACK_INGESTING_URL;

let logtail: Logtail | undefined;
if (token) {
  logtail = ingestingUrl ? new Logtail(token, { endpoint: ingestingUrl }) : new Logtail(token);
}

type LogMeta = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", message: string, meta?: LogMeta): void {
  const line = `[relay] ${message}`;
  if (level === "error") console.error(line, meta ?? "");
  else if (level === "warn") console.warn(line, meta ?? "");
  else console.log(line, meta ?? "");

  logtail?.[level](message, meta).catch(() => {
    // Never let a logging failure affect the request it's describing.
  });
}

export const logger = {
  info: (message: string, meta?: LogMeta) => emit("info", message, meta),
  warn: (message: string, meta?: LogMeta) => emit("warn", message, meta),
  error: (message: string, meta?: LogMeta) => emit("error", message, meta),
};
