import crypto from "crypto";
import bcrypt from "bcryptjs";

const BCRYPT_PREFIXES = ["$2a$", "$2b$", "$2y$", "$2x$"];
const SALT_ROUNDS = 10;

export function isBcryptHash(value) {
  return typeof value === "string" && BCRYPT_PREFIXES.some((p) => value.startsWith(p));
}

export async function hashPassword(plain) {
  return bcrypt.hash(String(plain).trim(), SALT_ROUNDS);
}

/**
 * Accepts bcrypt hashes (incl. PHP `$2y$` from HESK import) and legacy plain-text rows.
 * @returns {{ valid: boolean, needsRehash: boolean }}
 */
export async function verifyPassword(input, stored) {
  const candidate = String(input ?? "").trim();
  if (!candidate || !stored) return { valid: false, needsRehash: false };

  // A bcrypt row must never match its own hash string as a plain-text password.
  if (isBcryptHash(stored)) {
    try {
      return { valid: await bcrypt.compare(candidate, stored), needsRehash: false };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  const valid = crypto.timingSafeEqual(
    crypto.createHash("sha256").update(stored).digest(),
    crypto.createHash("sha256").update(candidate).digest()
  );
  return { valid, needsRehash: valid };
}

export function omitPassword(user) {
  if (!user) return user;
  const { password, ...rest } = user;
  return rest;
}
