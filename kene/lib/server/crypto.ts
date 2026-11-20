import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const KEY_LENGTH = 64;

export function hashAccessCode(code: string, salt: string): string {
  return scryptSync(code, salt, KEY_LENGTH).toString("hex");
}

export function verifyAccessCode(
  code: string,
  salt: string,
  expectedHash: string,
): boolean {
  const expected = Buffer.from(expectedHash, "hex");
  const actual = scryptSync(code, salt, KEY_LENGTH);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function createSalt(): string {
  return randomBytes(16).toString("hex");
}

/** Alphabet sans caractères ambigus (0/O, 1/I) pour un code recopié à la main. */
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createRecoveryCode(): string {
  const chars = Array.from(randomBytes(8), (byte) =>
    RECOVERY_ALPHABET.charAt(byte % RECOVERY_ALPHABET.length),
  );
  return `KNR-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}
