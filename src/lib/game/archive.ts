import type { SupabaseClient } from "@supabase/supabase-js";
import { FACTION_IDS, type FactionId } from "@/lib/factions";

export interface TopEntry {
  rank: number;
  wallet: string;
  faction: FactionId | null;
  renown: number;
}

/** The three great moments of a season, computed at the knell (archive_moments). */
export interface Moments {
  most_disputed?: { x: number; y: number; flips: number; owner: FactionId | null } | null;
  biggest_army?: { x: number; y: number; faction: FactionId; force: number } | null;
  plague?: { x: number; y: number; w: number; h: number; cells: number; force: number; at: string } | null;
}

export interface ArchiveSummary {
  number: number;
  name: string;
  startsAt: number;
  endsAt: number;
  winner: FactionId | null;
  scores: Record<FactionId, number>;
  /** the season's most renowned player, if any */
  champion: TopEntry | null;
}

export interface ArchivePage extends ArchiveSummary {
  /** [x, y, owner] of every held cell at the knell */
  cells: [number, number, FactionId][];
  top: TopEntry[];
  moments: Moments;
}

type ArchiveRow = {
  winner_faction_id: FactionId | null;
  scores: Record<FactionId, number>;
  cells?: [number, number, FactionId][];
  top: TopEntry[];
  moments?: Moments;
};
type Row = { number: number; name: string; starts_at: string; ends_at: string; season_archives: unknown };

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as ArchiveRow;
const topOf = (a: ArchiveRow) => (a.top ?? []).map((t) => ({ ...t, renown: Number(t.renown) }));

function summary(r: Row): ArchiveSummary {
  const a = one(r.season_archives);
  const top = topOf(a);
  return {
    number: r.number,
    name: r.name,
    startsAt: Date.parse(r.starts_at),
    endsAt: Date.parse(r.ends_at),
    winner: a.winner_faction_id,
    scores: a.scores,
    champion: top[0] ?? null,
  };
}

/** Every finished season, newest first (public data, RLS read). */
export async function listArchives(sb: SupabaseClient): Promise<ArchiveSummary[]> {
  const { data, error } = await sb
    .from("seasons")
    .select("number, name, starts_at, ends_at, season_archives!inner(winner_faction_id, scores, top)")
    .eq("status", "ended")
    .order("number", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(summary);
}

/** One page of the Chronicles, or null. */
export async function loadArchive(sb: SupabaseClient, number: number): Promise<ArchivePage | null> {
  const { data, error } = await sb
    .from("seasons")
    .select("number, name, starts_at, ends_at, season_archives!inner(winner_faction_id, scores, cells, top, moments)")
    .eq("status", "ended")
    .eq("number", number)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const a = one((data as Row).season_archives);
  return { ...summary(data as Row), cells: a.cells ?? [], top: topOf(a), moments: a.moments ?? {} };
}

/** The season still being written: its number, name, knell and the Banner in the lead. */
export interface CurrentSeason {
  number: number;
  name: string;
  endsAt: number;
  leader: FactionId | null;
  leaderPoints: number;
}

export async function loadCurrentSeason(sb: SupabaseClient): Promise<CurrentSeason | null> {
  const { data: s, error } = await sb.from("seasons").select("id, number, name, ends_at").eq("status", "active").maybeSingle();
  if (error) throw error;
  if (!s) return null;
  const totals = Object.fromEntries(FACTION_IDS.map((f) => [f, 0])) as Record<FactionId, number>;
  for (let from = 0; ; from += 1000) {
    const { data: ticks, error: tErr } = await sb
      .from("score_ticks")
      .select("faction_id, points")
      .eq("season_id", s.id)
      .order("hour")
      .range(from, from + 999);
    if (tErr) throw tErr;
    for (const t of ticks ?? []) totals[t.faction_id as FactionId] += t.points;
    if (!ticks || ticks.length < 1000) break;
  }
  const leader = [...FACTION_IDS].sort((a, b) => totals[b] - totals[a])[0];
  return {
    number: s.number,
    name: s.name,
    endsAt: Date.parse(s.ends_at),
    leader: totals[leader] > 0 ? leader : null,
    leaderPoints: totals[leader],
  };
}
