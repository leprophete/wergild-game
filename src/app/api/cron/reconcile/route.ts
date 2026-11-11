import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { syncWallets } from "@/lib/chain/sync";
import { hasSecret } from "@/lib/http/secret";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/cron/reconcile — safety net, every RECONCILE_MINUTES (10) via pg_cron + pg_net.
 * Re-reads the balance of every active player in case a webhook was missed, and lets
 * seniority (and so force) grow with time.
 */
export async function POST(req: Request) {
  if (!hasSecret(req, "CRON_SECRET")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = getAdminSupabase();
  const { data, error } = await sb
    .from("players")
    .select("wallet")
    .not("faction_id", "is", null)
    .not("wallet", "like", "DEMO%")
    .order("balance_synced_at", { ascending: true, nullsFirst: true })
    .limit(500);
  if (error) {
    console.error("reconcile: player list failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  const started = Date.now();
  const result = await syncWallets((data ?? []).map((p) => p.wallet));
  if (result.failures.length) console.error("reconcile: failures", result.failures.slice(0, 20));
  return NextResponse.json({ ok: true, synced: result.synced, failed: result.failures.length, ms: Date.now() - started });
}
