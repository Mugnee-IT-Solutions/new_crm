import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma generate does not connect to the database, but Prisma 7 config
// still requires a datasource URL when the config file is loaded.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
});
