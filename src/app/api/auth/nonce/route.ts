import { NextResponse } from "next/server";
import { NONCE_TTL_MINUTES } from "@config/game";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { buildSignInMessage, newNonce, requestDomain } from "@/lib/auth/siws";
import { nonceRequestSchema, parseJson } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/http/rateLimit";

/** POST /api/auth/nonce { wallet } → the message to sign (single-use nonce, 5 minutes). */
export async function POST(req: Request) {
  // a nonce is a row in the database: no flood from one address
  const limited = await rateLimit(`nonce:${clientIp(req)}`, 20, 60);
  if (limited) return limited;
  const body = await parseJson(req, nonceRequestSchema);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const domain = requestDomain(req);
  if (!domain) return NextResponse.json({ error: "unknown_domain" }, { status: 400 });

  const sb = getAdminSupabase();
  const nonce = newNonce();
  const expiresAt = new Date(Date.now() + NONCE_TTL_MINUTES * 60_000);

  // housekeeping: drop expired nonces of this wallet, keep the table small
  await sb.from("auth_nonces").delete().eq("wallet", body.wallet).lt("expires_at", new Date().toISOString());
  const { error } = await sb.from("auth_nonces").insert({ nonce, wallet: body.wallet, expires_at: expiresAt.toISOString() });
  if (error) {
    console.error("nonce insert failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json(
    { nonce, message: buildSignInMessage({ domain, wallet: body.wallet, nonce, expiresAt }) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
