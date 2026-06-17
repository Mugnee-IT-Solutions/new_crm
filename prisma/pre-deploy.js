const { execSync } = require("node:child_process");

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

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Add your production Postgres connection string in Vercel Project Settings → Environment Variables.",
  );
  process.exit(1);
}

run("npx prisma generate");

const failedMigration = "20260617000000_customer_phone2_city";
const status = readMigrateStatus();

if (status.includes(failedMigration) && status.toLowerCase().includes("failed")) {
  run(`npx prisma migrate resolve --rolled-back "${failedMigration}"`);
}

run("npx prisma migrate deploy");
