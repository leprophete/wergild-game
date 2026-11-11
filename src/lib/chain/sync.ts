import "server-only";
import { TOKENS_PER_SOLDIER, TOKEN_DECIMALS, VETERAN_MAX_DAYS } from "@config/game";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { fetchTokenBalance } from "./balance";

const UNITS_PER_SOLDIER = (BigInt(10) ** BigInt(TOKEN_DECIMALS) * BigInt(TOKENS_PER_SOLDIER)).toString();

export interface SyncResult {
  wallet: string;
  balance: string;
  soldiers: number;
  force: number;
  reserve: number;
  trimmed: boolean;
}

/**
 * Re-reads the on-chain balance and applies rules 1, 2 and 6 in one Postgres transaction.
 * Returns null if the wallet is not a player.
 */
export async function syncWallet(wallet: string): Promise<SyncResult | null> {
  const balance = await fetchTokenBalance(wallet);
  const { data, error } = await getAdminSupabase().rpc("apply_balance", {
    p_wallet: wallet,
    p_balance: balance.toString(),
    p_units_per_soldier: UNITS_PER_SOLDIER,
    p_veteran_days: VETERAN_MAX_DAYS,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    wallet,
    balance: balance.toString(),
    soldiers: Number(row.soldiers),
    force: Number(row.force),
    reserve: Number(row.reserve),
    trimmed: Boolean(row.trimmed),
  };
}

/** Syncs many wallets with limited concurrency (public RPCs rate-limit hard). */
export async function syncWallets(wallets: string[], concurrency = 4) {
  const results: (SyncResult | null)[] = [];
  const failures: { wallet: string; error: string }[] = [];
  let i = 0;
  const worker = async () => {
    while (i < wallets.length) {
      const w = wallets[i++];
      try {
        results.push(await syncWallet(w));
      } catch (e) {
        failures.push({ wallet: w, error: e instanceof Error ? e.message : String(e) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, wallets.length) }, worker));
  return { synced: results.filter(Boolean).length, failures };
}
