import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "pm_session";
const globalSecret = globalThis as typeof globalThis & { priceMatcherSessionSecret?: Buffer };
function secret() {
  const configured = process.env.PRICE_MATCHER_SESSION_SECRET;
  if (configured && configured.length >= 32) return Buffer.from(configured);
  if (process.env.NODE_ENV === "production") throw new Error("PRICE_MATCHER_SESSION_SECRET must contain at least 32 characters");
  return globalSecret.priceMatcherSessionSecret ??= randomBytes(32);
}
function signature(id: string) { return createHmac("sha256", secret()).update(id).digest("base64url"); }
export function createAnonymousSession() { const id = randomUUID(); return { id, token: `${id}.${signature(id)}` }; }
export function verifyAnonymousSession(token?: string) {
  if (!token) return null; const [id, supplied, extra] = token.split(".");
  if (!id || !supplied || extra || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const expected = signature(id); const left = Buffer.from(supplied); const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right) ? id : null;
}
