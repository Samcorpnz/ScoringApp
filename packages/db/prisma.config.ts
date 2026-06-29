import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // `prisma generate` only needs the schema, not a live connection — CI runs
  // it without DATABASE_URL set, so this must stay optional (unlike env(),
  // which throws if the var is missing) rather than fail the build.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
