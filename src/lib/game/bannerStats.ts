import { GRID_W } from "@config/game";
import { FACTION_IDS, type FactionId } from "@/lib/factions";
import { WATCHTOWER_CELLS } from "@/lib/map/mask";

export type HourRow = { hour: number; points: Record<FactionId, number> };

const zero = () => Object.fromEntries(FACTION_IDS.map((f) => [f, 0])) as Record<FactionId, number>;
const towerSet = new Set(WATCHTOWER_CELLS.map(([x, y]) => y * GRID_W + x));

/**
 * From the season's score ticks: the hourly history (every Banner, hours in order), each
 * Banner's season total, the rank of `id` (ties: SPEC order) and its last scored hour.
 */
export function summarize(ticks: { faction_id: string; points: number; hour: string }[], id: FactionId) {
  const byHour = new Map<string, Record<FactionId, number>>();
  const totals = zero();
  for (const t of ticks) {
    if (!FACTION_IDS.includes(t.faction_id as FactionId)) continue;
    let row = byHour.get(t.hour);
    if (!row) byHour.set(t.hour, (row = zero()));
    row[t.faction_id as FactionId] = t.points;
    totals[t.faction_id as FactionId] += t.points;
  }
  const history: HourRow[] = [...byHour.entries()]
    .map(([hour, points]) => ({ hour: Date.parse(hour), points }))
    .sort((a, b) => a.hour - b.hour);
  const ranked = [...FACTION_IDS].sort((a, b) => totals[b] - totals[a] || FACTION_IDS.indexOf(a) - FACTION_IDS.indexOf(b));
  return {
    history,
    totals,
    points: totals[id],
    rank: ranked.indexOf(id) + 1,
    lastHour: history.length ? history[history.length - 1].points[id] : 0,
  };
}

/** Running totals per Banner, hour by hour: [end of the hour (ms), points so far]. */
export function cumulative(history: HourRow[]): Record<FactionId, [number, number][]> {
  const out = Object.fromEntries(FACTION_IDS.map((f) => [f, [] as [number, number][]])) as Record<FactionId, [number, number][]>;
  const acc = zero();
  for (const h of history) {
    for (const f of FACTION_IDS) {
      acc[f] += h.points[f] ?? 0;
      out[f].push([h.hour + 3_600_000, acc[f]]);
    }
  }
  return out;
}

/** How many of these cells are watchtowers. */
export const countTowers = (cells: [number, number][]) => cells.filter(([x, y]) => towerSet.has(y * GRID_W + x)).length;
