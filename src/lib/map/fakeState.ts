import {
  COOLDOWN_MINUTES,
  EVENT_NOTICE_HOURS,
  GRID_H,
  GRID_W,
  SEASON_DAYS,
  SEASON_START_HOUR_UTC,
  SEASON_START_WEEKDAY_UTC,
  TITHE_HOURS,
} from "@config/game";
import { FACTIONS, FACTION_BY_ID, type FactionId } from "@/lib/factions";
import { hash2, mulberry32 } from "@/lib/rng";
import { STATIC_CELLS, cellId, cellLabel } from "./layout";
import { resolveOwner, type CellState, type FeedEntry, type GameEvent, type PlayerState } from "./state";

/**
 * Step 1 only: a believable mid-season map generated locally and deterministically.
 * Replaced by real Supabase data in step 2.
 */

const REACH: Record<FactionId, number> = { goblins: 16, changelings: 14, knaves: 11, unburied: 15, wretches: 17 };

/** Multi-source Dijkstra over land, 8 directions, with a smooth per-faction "terrain cost" so fronts look organic. */
function dijkstra(sources: number[], seed: number): number[] {
  const n = GRID_W * GRID_H;
  const dist = new Array<number>(n).fill(Infinity);
  const done = new Uint8Array(n);
  const land = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < GRID_W && y < GRID_H && STATIC_CELLS[cellId(x, y)].kind !== "blocked";
  const cost = (x: number, y: number) => {
    const wave = 0.5 + 0.5 * Math.sin(x * 0.55 + seed * 1.7) * Math.cos(y * 0.47 + seed * 0.9);
    return 1 + wave * 1.1;
  };
  for (const s of sources) dist[s] = 0;
  for (;;) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!done[i] && dist[i] < best) {
        best = dist[i];
        u = i;
      }
    }
    if (u < 0) break;
    done[u] = 1;
    const ux = u % GRID_W;
    const uy = Math.floor(u / GRID_W);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const vx = ux + dx;
        const vy = uy + dy;
        if (!land(vx, vy)) continue;
        // never slip diagonally between two river cells
        if (dx && dy && (!land(ux + dx, uy) || !land(ux, uy + dy))) continue;
        const v = cellId(vx, vy);
        const jitter = mulberry32(hash2(u, v, seed))() * 0.35;
        const w = cost(vx, vy) * (dx && dy ? 1.414 : 1) + jitter;
        if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
      }
    }
  }
  return dist;
}

export function seasonBounds(now: number) {
  const d = new Date(now);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), SEASON_START_HOUR_UTC));
  while (start.getUTCDay() !== SEASON_START_WEEKDAY_UTC || start.getTime() > now) start.setUTCDate(start.getUTCDate() - 1);
  const startsAt = start.getTime();
  return { startsAt, endsAt: startsAt + SEASON_DAYS * 86_400_000 };
}

export interface FakeWorld {
  cells: CellState[];
  player: PlayerState;
  events: GameEvent[];
  feed: FeedEntry[];
  season: { number: number; name: string; startsAt: number; endsAt: number };
  scores: Record<FactionId, number>;
  lastHour: Record<FactionId, number>;
}

export function generateFakeWorld(now: number): FakeWorld {
  const dists = Object.fromEntries(
    FACTIONS.map((f, i) => {
      const src: number[] = [];
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) src.push(cellId(f.base.x + dx, f.base.y + dy));
      return [f.id, dijkstra(src, i + 11)];
    }),
  ) as Record<FactionId, number[]>;

  const cells: CellState[] = STATIC_CELLS.map((sc) => {
    const rng = mulberry32(hash2(sc.x, sc.y, 99));
    const c: CellState = { id: sc.id, owner: null, forces: {}, mine: 0, wetUntil: null };
    if (sc.kind === "blocked") return c;
    if (sc.baseOf) {
      c.forces[sc.baseOf] = 14_000 + Math.floor(rng() * 5000);
      c.owner = sc.baseOf;
      return c;
    }
    const ranked = FACTIONS.map((f) => ({ f: f.id, d: dists[f.id][sc.id] / REACH[f.id] })).sort((a, b) => a.d - b.d);
    const [first, second] = ranked;
    if (first.d > 1) return c;
    // a few hundred force per cell on average (SPEC rule 1), more near the camps
    const strength = Math.pow(1 - first.d, 1.6);
    const main = Math.round(40 + strength * 3200 + rng() * 260);
    c.forces[first.f] = main;
    if (second.d < 1.2) {
      c.forces[second.f] = Math.round(main * (0.6 + rng() * 0.5));
    }
    // a few stray raiders deep in enemy land
    if (rng() < 0.05) {
      const raider = FACTIONS[Math.floor(rng() * 5)].id;
      if (raider !== first.f) c.forces[raider] = (c.forces[raider] ?? 0) + Math.round(main * rng() * 0.4);
    }
    c.owner = resolveOwner(first.f, c.forces);
    return c;
  });

  // The current (demo) player — a Wretch.
  const player: PlayerState = { wallet: "Wr3tch…9xQ", faction: "wretches", soldiers: 18_400, ageDays: 12 };
  const rng = mulberry32(4242);
  const mineCandidates = cells.filter((c) => c.owner === "wretches" || (c.forces.wretches ?? 0) > 0);
  let placed = 0;
  for (const c of mineCandidates) {
    if (placed >= 14) break;
    if (rng() > 0.18) continue;
    const amount = Math.min(c.forces.wretches ?? 0, 120 + Math.floor(rng() * 900));
    if (amount <= 0) continue;
    c.mine = amount;
    if (placed % 3 === 0) c.wetUntil = now + Math.floor((0.1 + rng() * 0.88) * COOLDOWN_MINUTES * 60_000);
    placed++;
  }

  const { startsAt, endsAt } = seasonBounds(now);
  const hours = Math.max(1, Math.floor((now - startsAt) / 3_600_000));
  const owned: Record<FactionId, number> = { goblins: 0, changelings: 0, knaves: 0, unburied: 0, wretches: 0 };
  for (const c of cells) if (c.owner) owned[c.owner] += STATIC_CELLS[c.id].kind === "bonus" ? 3 : 1;
  const scores = Object.fromEntries(
    FACTIONS.map((f, i) => [f.id, Math.round(owned[f.id] * hours * (0.85 + ((i * 37) % 23) / 100))]),
  ) as Record<FactionId, number>;

  const hourStart = Math.floor(now / 3_600_000) * 3_600_000;
  const events: GameEvent[] = [
    {
      id: "tithe-1",
      type: "tithe",
      zone: { x: 30, y: 13, w: 3, h: 3 },
      announcedAt: hourStart - 16 * 3_600_000,
      startsAt: hourStart - 9 * 3_600_000,
      endsAt: hourStart - 9 * 3_600_000 + TITHE_HOURS * 3_600_000,
    },
    {
      id: "plague-1",
      type: "plague",
      zone: { x: 8, y: 12, w: 4, h: 4 },
      announcedAt: hourStart - (EVENT_NOTICE_HOURS - 2) * 3_600_000,
      startsAt: hourStart + 4 * 3_600_000,
      endsAt: hourStart + 4 * 3_600_000,
    },
  ];

  const fid = (f: FactionId) => FACTION_BY_ID[f].name;
  const feed: FeedEntry[] = [
    { id: "f1", at: now - 2 * 60_000, text: `${fid("goblins")} took ${cellLabel(cellId(17, 9))}` },
    { id: "f2", at: now - 7 * 60_000, text: `${fid("knaves")} hold the bridge at ${cellLabel(cellId(28, 11))}` },
    { id: "f3", at: now - 15 * 60_000, text: `${fid("wretches")} took ${cellLabel(cellId(36, 19))}` },
    { id: "f4", at: now - 31 * 60_000, text: `${fid("unburied")} rose again at ${cellLabel(cellId(37, 9))}` },
    { id: "f5", at: now - 48 * 60_000, text: `The Plague is coming to ${cellLabel(cellId(8, 12))}` },
  ];

  return {
    cells,
    player,
    events,
    feed,
    season: { number: 1, name: "The Unsworn Lands", startsAt, endsAt },
    scores,
    lastHour: owned,
  };
}
