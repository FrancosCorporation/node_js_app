import { createHash } from "node:crypto";

export const BCRYPT_SHA256_PREFIX = "$bcrypt-sha256$";

export function prehashPassword(password: string): string {
  return createHash("sha256").update(password, "utf8").digest("base64url");
}
