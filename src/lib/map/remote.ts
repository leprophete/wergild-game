import type { SupabaseClient } from "@supabase/supabase-js";
import { GRID_W } from "@config/game";
import { FACTION_IDS, type FactionId } from "@/lib/factions";
import type { CellState, GameEvent } from "./state";

/** Wire format of GET /api/map — compact, one entry per cell in local id order (y * 48 + x). */
export interface MapPayload {
  season: { id: number; number: number; name: string; startsAt: number; endsAt: number };
  /** [ownerIndex | -1, contested 0/1] per cell */
  cells: [number, 0 | 1][];
  /** [localCellId, factionIndex, force] */
  strengths: [number, number, number][];
  events: GameEvent[];
  scores: Record<FactionId, number>;
  /** points of the last scored hour, per Banner */
  lastHour: Record<FactionId, number>;
  generatedAt: number;
}

const PAGE = 1000; // PostgREST max rows per request

export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

const fIndex = (f: string | null) => (f ? FACTION_IDS.indexOf(f as FactionId) : -1);

/** Reads the active season's public map. Works with the publishable key (RLS: public read). */
export async function loadMapPayload(sb: SupabaseClient): Promise<MapPayload | null> {
  const { data: season, error: sErr } = await sb
    .from("seasons")
    .select("id, number, name, starts_at, ends_at")
    .eq("status", "active")
    .maybeSingle();
  if (sErr) throw sErr;
  if (!season) return null;

  const [cells, strengths, events, ticks] = await Promise.all([
    fetchAll<{ id: number; x: number; y: number; owner_faction_id: string | null; contested: boolean }>((a, b) =>
      sb.from("cells").select("id, x, y, owner_faction_id, contested").eq("season_id", season.id).order("id").range(a, b),
    ),
    fetchAll<{ cell_id: number; faction_id: string; force: number }>((a, b) =>
      sb.rpc("map_strengths", { p_season_id: season.id }).order("cell_id").range(a, b),
    ),
    sb
      .from("events")
      .select("id, type, zone_x, zone_y, zone_w, zone_h, announced_at, starts_at, ends_at")
      .eq("season_id", season.id)
      .gt("ends_at", new Date().toISOString())
      .lte("announced_at", new Date().toISOString())
      .order("starts_at"),
    fetchAll<{ faction_id: string; points: number; hour: string }>((a, b) =>
      sb.from("score_ticks").select("faction_id, points, hour").eq("season_id", season.id).order("hour").range(a, b),
    ),
  ]);
  if (events.error) throw events.error;

  const localOf = new Map<number, number>();
  const outCells: [number, 0 | 1][] = [];
  for (const c of cells) {
    const local = c.y * GRID_W + c.x;
    localOf.set(c.id, local);
    outCells[local] = [fIndex(c.owner_faction_id), c.contested ? 1 : 0];
  }
  const scores = Object.fromEntries(FACTION_IDS.map((f) => [f, 0])) as Record<FactionId, number>;
  const lastHour = Object.fromEntries(FACTION_IDS.map((f) => [f, 0])) as Record<FactionId, number>;
  const latest = ticks.reduce((m, t) => (t.hour > m ? t.hour : m), "");
  for (const t of ticks) {
    scores[t.faction_id as FactionId] += t.points;
    if (t.hour === latest) lastHour[t.faction_id as FactionId] = t.points;
  }

  return {
    season: {
      id: season.id,
      number: season.number,
      name: season.name,
      startsAt: Date.parse(season.starts_at),
      endsAt: Date.parse(season.ends_at),
    },
    cells: outCells,
    strengths: strengths
      .filter((s) => localOf.has(s.cell_id))
      .map((s) => [localOf.get(s.cell_id)!, fIndex(s.faction_id), Number(s.force)]),
    events: (events.data ?? []).map((e) => ({
      id: String(e.id),
      type: e.type,
      zone: e.zone_x === null ? null : { x: e.zone_x, y: e.zone_y, w: e.zone_w, h: e.zone_h },
      announcedAt: Date.parse(e.announced_at),
      startsAt: Date.parse(e.starts_at),
      endsAt: Date.parse(e.ends_at),
    })),
    scores,
    lastHour,
    generatedAt: Date.now(),
  };
}

/** Rebuilds the renderer's CellState[] from the wire payload. */
export function payloadToCells(p: MapPayload): CellState[] {
  const cells: CellState[] = p.cells.map(([o, contested], id) => ({
    id,
    owner: o >= 0 ? FACTION_IDS[o] : null,
    forces: {},
    mine: 0,
    wetUntil: null,
    contested: contested === 1,
  }));
  for (const [id, f, force] of p.strengths) cells[id].forces[FACTION_IDS[f]] = force;
  return cells;
}
