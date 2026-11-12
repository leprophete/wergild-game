import "server-only";
import { FACTION_TELEGRAM_LINKS } from "@config/game";
import type { FactionId } from "@/lib/factions";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/map/remote";
import { countTowers, summarize, type HourRow } from "./bannerStats";

export interface BannerPage {
  id: FactionId;
  season: { number: number; name: string; startsAt: number; endsAt: number } | null;
  rank: number;
  points: number;
  lastHour: number;
  members: number;
  force: number;
  sharePct: number;
  /** [x, y] of every cell the Banner holds now */
  cells: [number, number][];
  towers: number;
  /** hourly points of the season, every Banner (for the history chart) */
  history: HourRow[];
  /** the season's most renowned members */
  top: { rank: number; wallet: string; renown: number }[];
  telegram: string | null;
}

const TOP = 10;

/**
 * Everything the /banner/[name] page shows. Server only: members and contributors come from
 * the players table, which the browser cannot read; only aggregates and public wallet
 * addresses leave the server.
 */
export async function loadBanner(id: FactionId): Promise<BannerPage> {
  const sb = getAdminSupabase();
  const [{ data: season, error: sErr }, status] = await Promise.all([
    sb.from("seasons").select("id, number, name, starts_at, ends_at").eq("status", "active").maybeSingle(),
    sb.rpc("banner_status"),
  ]);
  if (sErr) throw sErr;
  if (status.error) throw status.error;
  const mine = (status.data ?? []).find((r: { faction_id: string }) => r.faction_id === id) as
    | { members: number; force: number; share_pct: number }
    | undefined;

  const base: BannerPage = {
    id,
    season: season
      ? { number: season.number, name: season.name, startsAt: Date.parse(season.starts_at), endsAt: Date.parse(season.ends_at) }
      : null,
    rank: 0,
    points: 0,
    lastHour: 0,
    members: Number(mine?.members ?? 0),
    force: Number(mine?.force ?? 0),
    sharePct: Number(mine?.share_pct ?? 0),
    cells: [],
    towers: 0,
    history: [],
    top: [],
    telegram: FACTION_TELEGRAM_LINKS[id] || null,
  };
  if (!season) return base;

  const [ticks, cells, top] = await Promise.all([
    fetchAll<{ faction_id: string; points: number; hour: string }>((a, b) =>
      sb.from("score_ticks").select("faction_id, points, hour").eq("season_id", season.id).order("hour").range(a, b),
    ),
    fetchAll<{ x: number; y: number }>((a, b) =>
      sb.from("cells").select("x, y").eq("season_id", season.id).eq("owner_faction_id", id).order("id").range(a, b),
    ),
    sb
      .from("player_scores")
      .select("wallet, renown, players!inner(faction_id)")
      .eq("season_id", season.id)
      .eq("players.faction_id", id)
      .gt("renown", 0)
      .order("renown", { ascending: false })
      .order("wallet")
      .limit(TOP),
  ]);
  if (top.error) throw top.error;

  const sum = summarize(ticks, id);
  const held = cells.map((c) => [c.x, c.y] as [number, number]);

  return {
    ...base,
    rank: sum.rank,
    points: sum.points,
    lastHour: sum.lastHour,
    cells: held,
    towers: countTowers(held),
    history: sum.history,
    top: (top.data ?? []).map((r, i) => ({ rank: i + 1, wallet: r.wallet, renown: Number(r.renown) })),
  };
}
