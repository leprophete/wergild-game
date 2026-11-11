import "server-only";
import { createPublicKey, randomBytes, verify } from "node:crypto";
import bs58 from "bs58";
import { NONCE_TTL_MINUTES } from "@config/game";

/**
 * Sign-In With Solana: the player signs a free, human-readable message.
 * No transaction, no fee. The message is rebuilt server-side from the stored
 * nonce, so the client can never choose what it claims to have signed.
 */

export const newNonce = () => randomBytes(24).toString("base64url");

export function buildSignInMessage(opts: { domain: string; wallet: string; nonce: string; expiresAt: Date }) {
  // wallets compare the URI with the page origin: http only for local development
  const scheme = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(opts.domain) ? "http" : "https";
  const issuedAt = new Date(opts.expiresAt.getTime() - NONCE_TTL_MINUTES * 60_000);
  return [
    `${opts.domain} wants you to sign in with your Solana account:`,
    opts.wallet,
    "",
    "Swear your oath to a Banner of $WERGILD. This signature is free and sends no transaction.",
    "",
    `URI: ${scheme}://${opts.domain}`,
    "Version: 1",
    `Nonce: ${opts.nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${opts.expiresAt.toISOString()}`,
  ].join("\n");
}

/** ed25519 verification of `message` signed by the wallet's public key. */
export function verifySolanaSignature(wallet: string, message: string, signatureB64: string): boolean {
  try {
    const pub = bs58.decode(wallet);
    const sig = Buffer.from(signatureB64, "base64");
    if (pub.length !== 32 || sig.length !== 64) return false;
    const key = createPublicKey({
      key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(pub).toString("base64url") },
      format: "jwk",
    });
    return verify(null, Buffer.from(message, "utf8"), key, sig);
  } catch {
    return false;
  }
}

/**
 * The domain written in the message — only one of OUR domains (APP_DOMAIN, comma-separated).
 * A phishing site relaying requests to this API cannot get a message naming itself.
 * In development, localhost / 127.0.0.1 on any port are accepted.
 */
export function requestDomain(req: Request): string | null {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host)
    .split(",")[0]
    .trim()
    .toLowerCase();
  const allowed = (process.env.APP_DOMAIN ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.includes(host)) return host;
  if (process.env.NODE_ENV !== "production" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return host;
  return null;
}
