export function resolveDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.PRISMA_DATABASE_URL,
    process.env.NEON_DATABASE_URL,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }

  return "";
}

export function syncDatabaseUrlEnv() {
  const resolved = resolveDatabaseUrl();
  if (resolved) {
    process.env.DATABASE_URL = resolved;
  }
  return resolved;
}
