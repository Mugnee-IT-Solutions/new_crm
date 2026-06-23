const { execSync } = require("node:child_process");
const { syncDatabaseUrlEnv } = require("./database-url");

function run(command) {
  execSync(command, { stdio: "inherit" });
}

function readMigrateStatus() {
  try {
    return execSync("npx prisma migrate status", {
      encoding: "utf8",
      stdio: ["inherit", "pipe", "pipe"],
    });
  } catch (error) {
    const stdout = error.stdout?.toString() ?? "";
    const stderr = error.stderr?.toString() ?? "";
    return `${stdout}\n${stderr}`;
  }
}

const databaseUrl = syncDatabaseUrlEnv();

run("npx prisma generate");

if (!databaseUrl) {
  console.error(`
[CRM deploy] Database connection is missing.

Add this environment variable in your server or Vercel project:
  Project -> Settings -> Environment Variables

Required:
  DATABASE_URL          Your Postgres connection string

Recommended Vercel setup:
  1. Open your Vercel project
  2. Go to Storage -> Create Database -> Postgres
  3. Connect the database to this project
  4. Copy the generated connection string into DATABASE_URL
  5. Redeploy

Or use Neon / Supabase / Railway and paste the connection string into DATABASE_URL.
`);
  process.exit(1);
}

const failedMigration = "20260617000000_customer_phone2_city";
const status = readMigrateStatus();

if (status.includes(failedMigration) && status.toLowerCase().includes("failed")) {
  run(`npx prisma migrate resolve --rolled-back "${failedMigration}"`);
}

run("npx prisma migrate deploy");
