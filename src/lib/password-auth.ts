import * as crypto from "node:crypto";

const ARGON_ALGORITHM = "argon2id";
const ARGON_MEMORY = 65536;
const ARGON_PASSES = 3;
const ARGON_PARALLELISM = 1;
const ARGON_TAG_LENGTH = 32;
const ARGON_NONCE_LENGTH = 16;

type Argon2Parameters = {
  message: Buffer;
  nonce: Buffer;
  parallelism: number;
  tagLength: number;
  memory: number;
  passes: number;
};

const { randomBytes, timingSafeEqual } = crypto;
const argon2Sync = (crypto as typeof crypto & {
  argon2Sync: (algorithm: string, parameters: Argon2Parameters) => Buffer;
}).argon2Sync;

export function createSetupToken() {
  return randomBytes(24).toString("hex");
}

export function hashPassword(password: string) {
  const normalized = password.trim();
  if (!normalized) {
    throw new Error("Password is required.");
  }

  const nonce = randomBytes(ARGON_NONCE_LENGTH);
  const digest = argon2Sync(ARGON_ALGORITHM, {
    message: Buffer.from(normalized, "utf8"),
    nonce,
    parallelism: ARGON_PARALLELISM,
    tagLength: ARGON_TAG_LENGTH,
    memory: ARGON_MEMORY,
    passes: ARGON_PASSES,
  });

  return [
    ARGON_ALGORITHM,
    String(ARGON_MEMORY),
    String(ARGON_PASSES),
    String(ARGON_PARALLELISM),
    nonce.toString("base64url"),
    digest.toString("base64url"),
  ].join("$");
}

export function verifyPassword(password: string, storedHash?: string | null) {
  if (!storedHash) return false;

  const [algorithm, memory, passes, parallelism, nonceEncoded, digestEncoded] = storedHash.split("$");
  if (!algorithm || !memory || !passes || !parallelism || !nonceEncoded || !digestEncoded) {
    return false;
  }

  const nonce = Buffer.from(nonceEncoded, "base64url");
  const expectedDigest = Buffer.from(digestEncoded, "base64url");

  const actualDigest = argon2Sync(algorithm, {
    message: Buffer.from(password.trim(), "utf8"),
    nonce,
    parallelism: Number(parallelism),
    tagLength: expectedDigest.length,
    memory: Number(memory),
    passes: Number(passes),
  });

  if (actualDigest.length !== expectedDigest.length) {
    return false;
  }

  return timingSafeEqual(actualDigest, expectedDigest);
}
