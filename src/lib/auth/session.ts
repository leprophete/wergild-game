import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_DAYS } from "@config/game";
import { walletSchema } from "@/lib/validation";

/**
 * Session = httpOnly cookie "wg_session" holding `wallet.expiry.hmac`.
 * The HMAC (SESSION_SECRET, server only) makes it impossible to forge or to
 * swap in another wallet. JavaScript in the page cannot read it.
 */
const COOKIE = "wg_session";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET missing or too short");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export async function createSession(wallet: string) {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = `${wallet}.${exp}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(exp),
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** The signed-in wallet, or null. */
export async function getSessionWallet(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [wallet, exp, mac] = parts;
  const expected = sign(`${wallet}.${exp}`);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return null;
  return walletSchema.safeParse(wallet).success ? wallet : null;
}
