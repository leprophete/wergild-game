import type { SupabaseClient } from "@supabase/supabase-js";
import type { FactionId } from "@/lib/factions";

export interface ArchiveSummary {
  number: number;
  name: string;
  startsAt: number;
  endsAt: number;
  winner: FactionId | null;
  scores: Record<FactionId, number>;
}

export interface ArchivePage extends ArchiveSummary {
  /** [x, y, owner] of every held cell at the knell */
  cells: [number, number, FactionId][];
  top: { rank: number; wallet: string; faction: FactionId | null; renown: number }[];
}

const SELECT = "number, name, starts_at, ends_at, season_archives!inner(winner_faction_id, scores, cells, top)";

type Row = {
  number: number;
  name: string;
  starts_at: string;
  ends_at: string;
  season_archives: unknown;
};

function toPage(r: Row): ArchivePage {
  const a = (Array.isArray(r.season_archives) ? r.season_archives[0] : r.season_archives) as {
    winner_faction_id: FactionId | null;
    scores: Record<FactionId, number>;
    cells: [number, number, FactionId][];
    top: ArchivePage["top"];
  };
  return {
    number: r.number,
    name: r.name,
    startsAt: Date.parse(r.starts_at),
    endsAt: Date.parse(r.ends_at),
    winner: a.winner_faction_id,
    scores: a.scores,
    cells: a.cells,
    top: a.top.map((t) => ({ ...t, renown: Number(t.renown) })),
  };
}

/** Every finished season, newest first (public data, RLS read). */
export async function listArchives(sb: SupabaseClient): Promise<ArchiveSummary[]> {
  const { data, error } = await sb
    .from("seasons")
    .select("number, name, starts_at, ends_at, season_archives!inner(winner_faction_id, scores)")
    .eq("status", "ended")
    .order("number", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const a = (Array.isArray(r.season_archives) ? r.season_archives[0] : r.season_archives) as {
      winner_faction_id: FactionId | null;
      scores: Record<FactionId, number>;
    };
    return {
      number: r.number,
      name: r.name,
      startsAt: Date.parse(r.starts_at),
      endsAt: Date.parse(r.ends_at),
      winner: a.winner_faction_id,
      scores: a.scores,
    };
  });
}

/** One page of the Chronicles, or null. */
export async function loadArchive(sb: SupabaseClient, number: number): Promise<ArchivePage | null> {
  const { data, error } = await sb.from("seasons").select(SELECT).eq("status", "ended").eq("number", number).maybeSingle();
  if (error) throw error;
  return data ? toPage(data as Row) : null;
}
