import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time check of a shared secret sent as `Authorization: <secret>` or `Bearer <secret>`. */
export function hasSecret(req: Request, envName: string): boolean {
  const expected = process.env[envName];
  if (!expected || expected.length < 16) return false;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  // hash both sides so lengths always match for timingSafeEqual
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(expected).digest();
  return got.length > 0 && timingSafeEqual(a, b);
}
