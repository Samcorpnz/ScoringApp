import "dotenv/config";
import { initSentry, captureException } from "./sentry";
import { createServer } from "./server";

initSentry();

process.on("uncaughtException", (err) => {
  console.error("[relay] uncaught exception:", err);
  captureException(err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[relay] unhandled rejection:", reason);
  captureException(reason);
});

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
