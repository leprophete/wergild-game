import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { tokenMint } from "@/lib/chain/balance";
import { syncWallets } from "@/lib/chain/sync";
import { hasSecret } from "@/lib/http/secret";
import { walletSchema } from "@/lib/validation";

/**
 * POST /api/webhooks/helius — Helius "enhanced" webhook on transfers of the token.
 * The body only tells us WHICH wallets moved; amounts are never trusted:
 * every registered wallet involved is re-read by RPC and goes through apply_balance.
 */

const transfer = z.object({ fromUserAccount: z.string().nullish(), toUserAccount: z.string().nullish(), mint: z.string() });
const balanceChange = z.object({ userAccount: z.string().nullish(), mint: z.string() });
const tx = z
  .object({
    tokenTransfers: z.array(transfer).max(500).optional(),
    accountData: z
      .array(z.object({ tokenBalanceChanges: z.array(balanceChange).max(500).optional() }).passthrough())
      .max(500)
      .optional(),
  })
  .passthrough();
const payload = z.array(tx).max(100);

export async function POST(req: Request) {
  if (!hasSecret(req, "HELIUS_WEBHOOK_SECRET")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (Number(req.headers.get("content-length") ?? 0) > 2_000_000) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = payload.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const mint = tokenMint();
  const touched = new Set<string>();
  for (const t of parsed.data) {
    for (const tr of t.tokenTransfers ?? []) {
      if (tr.mint !== mint) continue;
      if (tr.fromUserAccount) touched.add(tr.fromUserAccount);
      if (tr.toUserAccount) touched.add(tr.toUserAccount);
    }
    for (const a of t.accountData ?? []) {
      for (const c of a.tokenBalanceChanges ?? []) if (c.mint === mint && c.userAccount) touched.add(c.userAccount);
    }
  }
  const candidates = [...touched].filter((w) => walletSchema.safeParse(w).success);
  if (candidates.length === 0) return NextResponse.json({ ok: true, synced: 0 });

  // only wallets that play: the pool and random holders are ignored
  const { data: players, error } = await getAdminSupabase().from("players").select("wallet").in("wallet", candidates);
  if (error) {
    console.error("webhook: player lookup failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  const result = await syncWallets((players ?? []).map((p) => p.wallet));
  if (result.failures.length) console.error("webhook: sync failures", result.failures);
  return NextResponse.json({ ok: true, synced: result.synced, failed: result.failures.length });
}
