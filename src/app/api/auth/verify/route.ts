import { NextResponse } from "next/server";
import { EXCLUDED_WALLETS } from "@config/game";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { buildSignInMessage, requestDomain, verifySolanaSignature } from "@/lib/auth/siws";
import { createSession } from "@/lib/auth/session";
import { parseJson, verifyRequestSchema } from "@/lib/validation";

/** POST /api/auth/verify { wallet, nonce, signature } → opens a session (httpOnly cookie). */
export async function POST(req: Request) {
  const body = await parseJson(req, verifyRequestSchema);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const domain = requestDomain(req);
  if (!domain) return NextResponse.json({ error: "unknown_domain" }, { status: 400 });

  const sb = getAdminSupabase();

  // Burn the nonce atomically: one statement, so a replayed signature finds it already used.
  const { data: burnt, error } = await sb
    .from("auth_nonces")
    .update({ used_at: new Date().toISOString() })
    .eq("nonce", body.nonce)
    .eq("wallet", body.wallet)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("expires_at");
  if (error) {
    console.error("nonce burn failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  if (!burnt || burnt.length !== 1) return NextResponse.json({ error: "nonce_invalid_or_expired" }, { status: 401 });

  // Rebuild the exact message server-side and check the ed25519 signature.
  const message = buildSignInMessage({
    domain,
    wallet: body.wallet,
    nonce: body.nonce,
    expiresAt: new Date(burnt[0].expires_at),
  });
  if (!verifySolanaSignature(body.wallet, message, body.signature)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  // First connection: create the player (no Banner yet). Rule 10: excluded wallets are flagged.
  const { error: upErr } = await sb
    .from("players")
    .upsert(
      { wallet: body.wallet, is_excluded: EXCLUDED_WALLETS.includes(body.wallet) },
      { onConflict: "wallet", ignoreDuplicates: true },
    );
  if (upErr) {
    console.error("player upsert failed", upErr);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  await createSession(body.wallet);
  return NextResponse.json({ ok: true, wallet: body.wallet });
}
