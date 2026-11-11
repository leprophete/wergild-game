import { BASE_CAMP_SIZE, GRID_H, GRID_W } from "@config/game";
import { FACTIONS, type FactionId } from "@/lib/factions";
import { hash2, mulberry32 } from "@/lib/rng";

/**
 * Static geography of the map: river, island, bridges, watchtowers, homelands.
 * The river runs north→south and splits into two arms around Knave's Hollow;
 * each arm has 2 bridges, and the island is reachable only through them.
 */

export type CellKind = "normal" | "bonus" | "bridge" | "blocked";
export type Terrain = "plain" | "forest" | "mountain" | "village" | "river" | "bridge";

export interface StaticCell {
  id: number;
  x: number;
  y: number;
  kind: CellKind;
  terrain: Terrain;
  /** Homeland this cell belongs to (for drawing), if any. */
  region: FactionId | null;
  /** Base camp owner, if this cell is part of a 2×2 base camp. */
  baseOf: FactionId | null;
}

export const cellId = (x: number, y: number) => y * GRID_W + x;
export const cellXY = (id: number) => ({ x: id % GRID_W, y: Math.floor(id / GRID_W) });

const rowName = (y: number) => (y < 26 ? String.fromCharCode(65 + y) : "A" + String.fromCharCode(65 + y - 26));
/** Human label, e.g. "C-14" = row C, column 14. */
export const cellLabel = (id: number) => {
  const { x, y } = cellXY(id);
  return `${rowName(y)}-${x + 1}`;
};
export const colLabel = (x: number) => String(x + 1);
export { rowName };

// --- River -----------------------------------------------------------------
const NORTH_OFFSETS = [1, 1, 1, 0, 0, 0]; // rows 0..5, main channel 2 cells wide
const SOUTH_OFFSETS = [0, 0, -1, -1, -1, 0]; // rows 24..29
const WEST_ARM_DIAG: Record<number, number> = { 6: 22, 7: 21, 8: 20, 21: 20, 22: 21, 23: 22 };
export const FORK_TOP = 6;
export const FORK_BOTTOM = 23;

export const westArmX = (y: number) => WEST_ARM_DIAG[y] ?? 19;
export const eastArmX = (y: number) => GRID_W - 1 - westArmX(y);

/** River cells (x) on a given row. */
export function riverXs(y: number): number[] {
  if (y < FORK_TOP) {
    const o = NORTH_OFFSETS[y];
    return [23 + o, 24 + o];
  }
  if (y > FORK_BOTTOM) {
    const o = SOUTH_OFFSETS[y - FORK_BOTTOM - 1];
    return [23 + o, 24 + o];
  }
  return [westArmX(y), eastArmX(y)];
}

export const isIsland = (x: number, y: number) =>
  y >= FORK_TOP && y <= FORK_BOTTOM && x > westArmX(y) && x < eastArmX(y);

export const BRIDGES: [number, number][] = [
  [19, 11],
  [19, 18],
  [28, 11],
  [28, 18],
];

export const WATCHTOWERS: [number, number][] = [
  [13, 8],
  [34, 8],
  [13, 21],
  [34, 21],
  [9, 15],
  [38, 15],
  [23, 9],
  [24, 20],
];

const HOMELAND_RADIUS = 6.5;

function homelandOf(x: number, y: number): FactionId | null {
  if (isIsland(x, y)) return "knaves";
  for (const f of FACTIONS) {
    if (f.id === "knaves") continue;
    const cx = f.base.x + BASE_CAMP_SIZE / 2;
    const cy = f.base.y + BASE_CAMP_SIZE / 2;
    if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= HOMELAND_RADIUS) return f.id;
  }
  return null;
}

function baseOf(x: number, y: number): FactionId | null {
  for (const f of FACTIONS) {
    if (x >= f.base.x && x < f.base.x + BASE_CAMP_SIZE && y >= f.base.y && y < f.base.y + BASE_CAMP_SIZE) return f.id;
  }
  return null;
}

function genericTerrain(x: number, y: number): Terrain {
  const n = Math.sin(x * 0.42 + 1.3) * Math.cos(y * 0.51 - 0.7) + 0.55 * Math.sin((x + y) * 0.23 + 0.4);
  const r = mulberry32(hash2(x, y, 7))();
  if (n > 0.95) return "mountain";
  if (n < -0.85) return "forest";
  if (r < 0.035) return "village";
  return "plain";
}

function buildStaticCells(): StaticCell[] {
  const cells: StaticCell[] = [];
  const bridgeSet = new Set(BRIDGES.map(([x, y]) => cellId(x, y)));
  const towerSet = new Set(WATCHTOWERS.map(([x, y]) => cellId(x, y)));
  for (let y = 0; y < GRID_H; y++) {
    const river = riverXs(y);
    for (let x = 0; x < GRID_W; x++) {
      const id = cellId(x, y);
      let kind: CellKind = "normal";
      let terrain: Terrain;
      if (bridgeSet.has(id)) {
        kind = "bridge";
        terrain = "bridge";
      } else if (river.includes(x)) {
        kind = "blocked";
        terrain = "river";
      } else {
        terrain = genericTerrain(x, y);
        if (towerSet.has(id)) kind = "bonus";
      }
      const region = kind === "blocked" ? null : homelandOf(x, y);
      cells.push({ id, x, y, kind, terrain, region, baseOf: baseOf(x, y) });
    }
  }
  return cells;
}

export const STATIC_CELLS: StaticCell[] = buildStaticCells();

export function neighbors(id: number): number[] {
  const { x, y } = cellXY(id);
  const out: number[] = [];
  if (x > 0) out.push(id - 1);
  if (x < GRID_W - 1) out.push(id + 1);
  if (y > 0) out.push(id - GRID_W);
  if (y < GRID_H - 1) out.push(id + GRID_W);
  return out;
}
