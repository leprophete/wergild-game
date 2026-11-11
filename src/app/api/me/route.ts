import { NextResponse } from "next/server";
import { FACTION_SWITCHES_PER_SEASON, GRID_W } from "@config/game";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getSessionWallet } from "@/lib/auth/session";
import { currentAgeDays, forceOf, soldiersFromBalance, veteranMultiplier } from "@/lib/game/rules";
import type { FactionId } from "@/lib/factions";
import type { MeResponse } from "@/lib/game/types";
import { syncWallet } from "@/lib/chain/sync";

/** Re-read the chain at most this often on page loads (webhooks and the 10-min job do the rest). */
const STALE_MS = 60_000;

export const dynamic = "force-dynamic";

/** GET /api/me — profile, force, reserve, deployments of the signed-in wallet. */
export async function GET() {
  const wallet = await getSessionWallet();
  if (!wallet) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const sb = getAdminSupabase();
  const readPlayer = () => sb.from("players").select("*").eq("wallet", wallet).maybeSingle();
  let { data: p, error } = await readPlayer();
  if (p && (!p.balance_synced_at || Date.now() - Date.parse(p.balance_synced_at) > STALE_MS)) {
    try {
      await syncWallet(wallet);
      ({ data: p, error } = await readPlayer());
    } catch (e) {
      console.error("me: balance sync failed (showing last known balance)", e);
    }
  }
  if (error) {
    console.error("me: player read failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  if (!p) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const { data: season } = await sb.from("seasons").select("id").eq("status", "active").maybeSingle();
  let deployments: MeResponse["deployments"] = [];
  let cellsHeld = 0;
  let renown = 0;
  if (season) {
    const [{ data: deps }, { data: score }] = await Promise.all([
      sb
        .from("deployments")
        .select("force, locked_until, cells!inner(x, y, owner_faction_id)")
        .eq("wallet", wallet)
        .eq("season_id", season.id),
      sb.from("player_scores").select("renown").eq("season_id", season.id).eq("wallet", wallet).maybeSingle(),
    ]);
    for (const d of deps ?? []) {
      const c = d.cells as unknown as { x: number; y: number; owner_faction_id: string | null };
      deployments.push({ cell: c.y * GRID_W + c.x, force: Number(d.force), lockedUntil: Date.parse(d.locked_until) });
      if (p.faction_id && c.owner_faction_id === p.faction_id) cellsHeld++;
    }
    deployments = deployments.sort((a, b) => a.cell - b.cell);
    renown = Number(score?.renown ?? 0);
  }

  const ageDays = currentAgeDays(Number(p.age_days), Date.parse(p.age_updated_at));
  const soldiers = soldiersFromBalance(String(p.balance));
  const force = forceOf(soldiers, ageDays);
  const deployed = deployments.reduce((s, d) => s + d.force, 0);

  const me: MeResponse = {
    wallet,
    faction: (p.faction_id as FactionId | null) ?? null,
    excluded: p.is_excluded,
    balance: String(p.balance),
    soldiers,
    ageDays: Math.floor(ageDays * 10) / 10,
    veteranMultiplier: veteranMultiplier(ageDays),
    force,
    reserve: Math.max(0, force - deployed),
    deployed,
    switchesLeft: Math.max(0, FACTION_SWITCHES_PER_SEASON - p.faction_switches),
    deployments,
    cellsHeld,
    renown,
    badges: [],
  };
  return NextResponse.json(me, { headers: { "Cache-Control": "no-store" } });
}
