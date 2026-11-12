import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getSessionWallet } from "@/lib/auth/session";
import { FACTION_IDS, type FactionId } from "@/lib/factions";
import type { RankingResponse } from "@/lib/game/ranking";
import { fetchAll } from "@/lib/map/remote";

export const dynamic = "force-dynamic";

const TOP = 100;

/** GET /api/ranking — Banner points of the season and the players' Renown. */
export async function GET() {
  const sb = getAdminSupabase();
  const wallet = await getSessionWallet();
  const { data: season, error: sErr } = await sb
    .from("seasons")
    .select("id, number, name")
    .eq("status", "active")
    .maybeSingle();
  if (sErr) {
    console.error("ranking: season read failed", sErr);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  const empty = FACTION_IDS.map((id) => ({ id, points: 0, lastHour: 0 }));
  if (!season) {
    const body: RankingResponse = { season: null, factions: empty, players: [], me: null, lastTick: null };
    return NextResponse.json(body);
  }

  const [ticks, top] = await Promise.all([
    fetchAll<{ faction_id: string; points: number; hour: string }>((a, b) =>
      sb.from("score_ticks").select("faction_id, points, hour").eq("season_id", season.id).order("hour").range(a, b),
    ).then(
      (data) => ({ data, error: null }),
      (error) => ({ data: null, error }),
    ),
    sb
      .from("player_scores")
      .select("wallet, renown, players!inner(faction_id)")
      .eq("season_id", season.id)
      .gt("renown", 0)
      .order("renown", { ascending: false })
      .order("wallet")
      .limit(TOP),
  ]);
  if (ticks.error || top.error) {
    console.error("ranking: read failed", ticks.error ?? top.error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const pts = new Map<FactionId, { points: number; lastHour: number }>(
    FACTION_IDS.map((f) => [f, { points: 0, lastHour: 0 }]),
  );
  const latest = (ticks.data ?? []).reduce((m, t) => (t.hour > m ? t.hour : m), "");
  for (const t of ticks.data ?? []) {
    const e = pts.get(t.faction_id as FactionId);
    if (!e) continue;
    e.points += t.points;
    if (t.hour === latest) e.lastHour = t.points;
  }

  const factionOf = (row: { players: unknown }) =>
    ((row.players as { faction_id: string | null } | null)?.faction_id ?? null) as FactionId | null;
  const players = (top.data ?? []).map((r, i) => ({
    rank: i + 1,
    wallet: r.wallet,
    faction: factionOf(r),
    renown: Number(r.renown),
  }));

  let me: RankingResponse["me"] = null;
  if (wallet) {
    me = players.find((p) => p.wallet === wallet) ?? null;
    if (!me) {
      const { data: mine } = await sb
        .from("player_scores")
        .select("renown, players!inner(faction_id)")
        .eq("season_id", season.id)
        .eq("wallet", wallet)
        .maybeSingle();
      const renown = Number(mine?.renown ?? 0);
      const { data: p } = mine ? { data: null } : await sb.from("players").select("faction_id").eq("wallet", wallet).maybeSingle();
      // rank = 1 + players strictly ahead (ties share the better rank)
      const { count } = await sb
        .from("player_scores")
        .select("wallet", { count: "exact", head: true })
        .eq("season_id", season.id)
        .gt("renown", renown);
      me = {
        rank: renown > 0 ? (count ?? 0) + 1 : 0,
        wallet,
        faction: mine ? factionOf(mine) : ((p?.faction_id ?? null) as FactionId | null),
        renown,
      };
    }
  }

  const body: RankingResponse = {
    season: { number: season.number, name: season.name },
    factions: FACTION_IDS.map((id) => ({ id, ...pts.get(id)! })).sort((a, b) => b.points - a.points),
    players,
    me,
    lastTick: latest ? Date.parse(latest) + 3_600_000 : null,
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
