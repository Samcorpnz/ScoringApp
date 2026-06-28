import "dotenv/config";
import { initSentry, captureException } from "./sentry";

// initSentry() must run before express (imported transitively via ./server)
// is loaded, otherwise Sentry's auto-instrumentation can't patch it for
// request tracing — hence the dynamic import below instead of a static one.
initSentry();

process.on("uncaughtException", (err) => {
  console.error("[relay] uncaught exception:", err);
  captureException(err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[relay] unhandled rejection:", reason);
  captureException(reason);
});

async function main(): Promise<void> {
  const { createServer } = await import("./server");

  const PORT = parseInt(process.env.PORT ?? "4000", 10);
  const UPLOAD_DIR = process.env.UPLOAD_DIR ?? require("path").join(process.cwd(), "uploads");

  const { httpServer } = createServer({ uploadDir: UPLOAD_DIR });

  httpServer.listen(PORT, () => {
    console.log(`=== ScoreHub Relay :${PORT} ===`);
    console.log(`  Logos:   POST /api/logo/:team  (x-control-secret header)`);
    console.log(`  State:   GET  /state`);
    console.log(`  Health:  GET  /health`);
    console.log(`  Uploads: ${UPLOAD_DIR}`);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  captureException(err);
  process.exit(1);
});
