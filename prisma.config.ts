import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./prisma/database-url.js";

const databaseUrl =
  resolveDatabaseUrl() ||
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
