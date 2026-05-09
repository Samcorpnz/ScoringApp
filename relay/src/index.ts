import "dotenv/config";
import { createServer } from "./server";

const PORT = parseInt(process.env.PORT ?? "4000", 10);
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? require("path").join(process.cwd(), "uploads");

const { httpServer } = createServer({ uploadDir: UPLOAD_DIR });

httpServer.listen(PORT, () => {
  console.log(`=== Scoreboard Relay :${PORT} ===`);
  console.log(`  Logos:   POST /api/logo/:team  (x-control-secret header)`);
  console.log(`  State:   GET  /state`);
  console.log(`  Uploads: ${UPLOAD_DIR}`);
});
