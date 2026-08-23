import { log as betterStackLog } from "@logtail/next";

// Ships structured logs directly to Better Stack from app code rather than
// a Vercel log drain (drains need the Pro plan; this team is on Hobby) —
// @logtail/next's `log` singleton is a no-op until BETTER_STACK_SOURCE_TOKEN
// is set, same fallback pattern as Sentry.
type LogMeta = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", message: string, meta?: LogMeta): void {
  const line = `[frontend] ${message}`;
  if (level === "error") console.error(line, meta ?? "");
  else if (level === "warn") console.warn(line, meta ?? "");
  else console.log(line, meta ?? "");

  betterStackLog[level](message, meta);
}

export const logger = {
  info: (message: string, meta?: LogMeta) => emit("info", message, meta),
  warn: (message: string, meta?: LogMeta) => emit("warn", message, meta),
  error: (message: string, meta?: LogMeta) => emit("error", message, meta),
  // Serverless functions can freeze/terminate before @logtail/next's
  // throttled (1s) background send fires — call this before returning a
  // response from any route handler that just logged a security event.
  flush: () => betterStackLog.flush(),
};
