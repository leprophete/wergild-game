import { BASE_CAMP_SIZE, GRID_H, GRID_W } from "@config/game";
import { FACTIONS, type FactionId } from "@/lib/factions";
import { WATCHTOWER_CELLS, WORLD_MASK } from "./mask";

/**
 * Static geography of the map, derived from the land/water mask of public/map/world@4x.webp:
 * sea and river are not playable; the river splits around Knave's Hollow and is crossed
 * only by the four bridges.
 */

export type CellKind = "normal" | "bonus" | "bridge" | "blocked";
export type Terrain = "land" | "water" | "bridge";

export interface StaticCell {
  id: number;
  x: number;
  y: number;
  kind: CellKind;
  terrain: Terrain;
  /** Homeland this cell belongs to, if any (labels, panel). */
  region: FactionId | null;
  /** Base camp owner, if this cell is part of a 2×2 base camp. */
  baseOf: FactionId | null;
}

export const cellId = (x: number, y: number) => y * GRID_W + x;
export const cellXY = (id: number) => ({ x: id % GRID_W, y: Math.floor(id / GRID_W) });

export const rowName = (y: number) => (y < 26 ? String.fromCharCode(65 + y) : "A" + String.fromCharCode(65 + y - 26));
/** Human label, e.g. "C-14" = row C, column 14. */
export const cellLabel = (id: number) => {
  const { x, y } = cellXY(id);
  return `${rowName(y)}-${x + 1}`;
};
export const colLabel = (x: number) => String(x + 1);

export const isPlayable = (x: number, y: number) => WORLD_MASK[y]?.[x] !== undefined && WORLD_MASK[y][x] !== "~";

export function neighbors(id: number): number[] {
  const { x, y } = cellXY(id);
  const out: number[] = [];
  if (x > 0) out.push(id - 1);
  if (x < GRID_W - 1) out.push(id + 1);
  if (y > 0) out.push(id - GRID_W);
  if (y < GRID_H - 1) out.push(id + GRID_W);
  return out;
}

const HOMELAND_RADIUS = 6.5;

function baseOf(x: number, y: number): FactionId | null {
  for (const f of FACTIONS) {
    if (x >= f.base.x && x < f.base.x + BASE_CAMP_SIZE && y >= f.base.y && y < f.base.y + BASE_CAMP_SIZE) return f.id;
  }
  return null;
}

/** Land mass of every playable cell when bridges are NOT crossed (west, east, island). */
function landMasses(): Int16Array {
  const mass = new Int16Array(GRID_W * GRID_H).fill(-1);
  let next = 0;
  for (let id = 0; id < mass.length; id++) {
    const { x, y } = cellXY(id);
    if (mass[id] !== -1 || WORLD_MASK[y][x] !== ".") continue;
    const stack = [id];
    while (stack.length) {
      const c = stack.pop()!;
      if (mass[c] !== -1) continue;
      mass[c] = next;
      for (const n of neighbors(c)) {
        const p = cellXY(n);
        if (mass[n] === -1 && WORLD_MASK[p.y][p.x] === ".") stack.push(n);
      }
    }
    next++;
  }
  return mass;
}

function buildStaticCells(): StaticCell[] {
  const towers = new Set(WATCHTOWER_CELLS.map(([x, y]) => cellId(x, y)));
  const mass = landMasses();
  const homeMass = Object.fromEntries(FACTIONS.map((f) => [f.id, mass[cellId(f.base.x, f.base.y)]])) as Record<FactionId, number>;
  const cells: StaticCell[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const id = cellId(x, y);
      const g = WORLD_MASK[y][x];
      const terrain: Terrain = g === "~" ? "water" : g === "=" ? "bridge" : "land";
      const kind: CellKind = terrain === "water" ? "blocked" : terrain === "bridge" ? "bridge" : towers.has(id) ? "bonus" : "normal";
      // homeland: the island for the Knaves, otherwise the cells near the camp on the same land mass
      let region: FactionId | null = null;
      if (terrain === "land") {
        for (const f of FACTIONS) {
          if (mass[id] !== homeMass[f.id]) continue;
          const d = Math.hypot(x + 0.5 - (f.base.x + 1), y + 0.5 - (f.base.y + 1));
          if (f.id === "knaves" || d <= HOMELAND_RADIUS) {
            region = f.id;
            break;
          }
        }
      }
      cells.push({ id, x, y, kind, terrain, region, baseOf: terrain === "land" ? baseOf(x, y) : null });
    }
  }
  return cells;
}

export const STATIC_CELLS: StaticCell[] = buildStaticCells();
