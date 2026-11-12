import { GRID_H, GRID_W } from "@config/game";
import type { FactionId } from "@/lib/factions";

/**
 * Zones and their frontiers — pure geometry, computed once per change of owners.
 *
 *  1. cells of one Banner touching by a side merge into a zone;
 *  2. the zone outline is traced along the cell edges (outer ring and holes);
 *  3. edges facing the water (coast, river, map edge) are flagged: no frontier is
 *     drawn there, so a frontier never runs over the water;
 *  4. the rings are smoothed into curves with Chaikin's corner cutting;
 *  5. the crest goes on the zone's most central cell, sized by the zone's area.
 *
 * Coordinates are in cells (multiply by the cell size to draw).
 */

export type Pt = [number, number];

export interface Ring {
  /** smoothed closed ring */
  points: Pt[];
  /** frontier[i] — is the segment points[i] → points[i+1] a drawn frontier (not facing water)? */
  frontier: boolean[];
}

export interface Zone {
  owner: FactionId;
  cells: number[];
  rings: Ring[];
  /** crest centre (cells) and height (cells) */
  crest: { x: number; y: number; size: number };
}

const SMOOTHING_PASSES = 3;

export function computeZones(
  owners: (FactionId | null)[],
  playable: (x: number, y: number) => boolean,
): Zone[] {
  const W = GRID_W;
  const H = GRID_H;
  const zoneOf = new Int32Array(W * H).fill(-1);
  const zones: Zone[] = [];
  const ownerAt = (x: number, y: number) =>
    x < 0 || y < 0 || x >= W || y >= H || !playable(x, y) ? null : owners[y * W + x];

  // 1. connected components (4-neighbourhood), land only
  for (let id = 0; id < W * H; id++) {
    const o = ownerAt(id % W, Math.floor(id / W));
    if (!o || zoneOf[id] !== -1) continue;
    const z = zones.length;
    const cells: number[] = [];
    const stack = [id];
    zoneOf[id] = z;
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      const x = c % W;
      const y = Math.floor(c / W);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const n = ny * W + nx;
        if (ownerAt(nx, ny) === o && zoneOf[n] === -1) {
          zoneOf[n] = z;
          stack.push(n);
        }
      }
    }
    zones.push({ owner: o, cells, rings: [], crest: { x: 0, y: 0, size: 0 } });
  }

  for (let z = 0; z < zones.length; z++) {
    const zone = zones[z];
    const inZone = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && zoneOf[y * W + x] === z;
    const facesWater = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || !playable(x, y);

    // 2. directed boundary edges, zone on the right (clockwise on screen)
    type Edge = { a: Pt; b: Pt; water: boolean; used: boolean };
    const out = new Map<string, Edge[]>();
    const key = (p: Pt) => `${p[0]},${p[1]}`;
    const add = (a: Pt, b: Pt, water: boolean) => {
      const e = { a, b, water, used: false };
      const k = key(a);
      const list = out.get(k);
      if (list) list.push(e);
      else out.set(k, [e]);
    };
    for (const c of zone.cells) {
      const x = c % W;
      const y = Math.floor(c / W);
      if (!inZone(x, y - 1)) add([x, y], [x + 1, y], facesWater(x, y - 1));
      if (!inZone(x + 1, y)) add([x + 1, y], [x + 1, y + 1], facesWater(x + 1, y));
      if (!inZone(x, y + 1)) add([x + 1, y + 1], [x, y + 1], facesWater(x, y + 1));
      if (!inZone(x - 1, y)) add([x, y + 1], [x, y], facesWater(x - 1, y));
    }

    // trace rings; at a pinch (two cells touching by a corner) take the right turn
    for (const list of out.values()) {
      for (const start of list) {
        if (start.used) continue;
        const pts: Pt[] = [];
        const water: boolean[] = [];
        let e: Edge | undefined = start;
        while (e && !e.used) {
          e.used = true;
          pts.push(e.a);
          water.push(e.water);
          const nexts: Edge[] = (out.get(key(e.b)) ?? []).filter((n) => !n.used);
          if (nexts.length <= 1) e = nexts[0];
          else {
            const dx: number = e.b[0] - e.a[0];
            const dy: number = e.b[1] - e.a[1];
            // right turn on screen (y down): (dx, dy) → (-dy, dx)
            e = nexts.find((n: Edge) => n.b[0] - n.a[0] === -dy && n.b[1] - n.a[1] === dx) ?? nexts[0];
          }
        }
        if (pts.length >= 4) zone.rings.push(smoothRing(simplify(pts, water)));
      }
    }

    // 5. crest: the cell farthest from the zone's edge (ties: closest to the centroid)
    zone.crest = placeCrest(zone.cells, inZone);
  }
  return zones;
}

/** Keeps only corners and changes of kind (frontier/water), so smoothing follows the shape. */
function simplify(pts: Pt[], water: boolean[]): { pts: Pt[]; water: boolean[] } {
  const n = pts.length;
  const keepPts: Pt[] = [];
  const keepWater: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const p = pts[i];
    const next = pts[(i + 1) % n];
    const straight = (p[0] - prev[0]) * (next[1] - p[1]) - (p[1] - prev[1]) * (next[0] - p[0]) === 0;
    const sameKind = water[(i - 1 + n) % n] === water[i];
    // a straight point between two edges of the same kind merges into one segment
    if (!straight || !sameKind) {
      keepPts.push(p);
      keepWater.push(water[i]);
    }
  }
  return { pts: keepPts, water: keepWater };
}

/**
 * Chaikin's corner cutting on a closed ring. A corner between a frontier segment and
 * a water segment stays a frontier, so a frontier reaches the shore; the caller clips
 * every stroke to the land so nothing is drawn over the water.
 */
function smoothRing({ pts, water }: { pts: Pt[]; water: boolean[] }): Ring {
  let P = pts;
  let F = water.map((w) => !w);
  for (let pass = 0; pass < SMOOTHING_PASSES; pass++) {
    const n = P.length;
    const NP: Pt[] = [];
    const NF: boolean[] = [];
    for (let i = 0; i < n; i++) {
      const a = P[i];
      const b = P[(i + 1) % n];
      NP.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
      NF.push(F[i]);
      NP.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
      NF.push(F[i] || F[(i + 1) % n]);
    }
    P = NP;
    F = NF;
  }
  return { points: P, frontier: F };
}

function placeCrest(cells: number[], inZone: (x: number, y: number) => boolean) {
  const W = GRID_W;
  // distance to the outside, by breadth-first layers from the boundary cells
  const dist = new Map<number, number>();
  let layer: number[] = [];
  for (const c of cells) {
    const x = c % W;
    const y = Math.floor(c / W);
    if (!inZone(x - 1, y) || !inZone(x + 1, y) || !inZone(x, y - 1) || !inZone(x, y + 1)) {
      dist.set(c, 0);
      layer.push(c);
    }
  }
  let d = 0;
  while (layer.length) {
    const nextLayer: number[] = [];
    d++;
    for (const c of layer) {
      const x = c % W;
      const y = Math.floor(c / W);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const n = ny * W + nx;
        if (inZone(nx, ny) && !dist.has(n)) {
          dist.set(n, d);
          nextLayer.push(n);
        }
      }
    }
    layer = nextLayer;
  }
  const mx = cells.reduce((s, c) => s + (c % W) + 0.5, 0) / cells.length;
  const my = cells.reduce((s, c) => s + Math.floor(c / W) + 0.5, 0) / cells.length;
  let best = cells[0];
  let bestScore = -Infinity;
  for (const c of cells) {
    const score = (dist.get(c) ?? 0) * 100 - Math.hypot((c % W) + 0.5 - mx, Math.floor(c / W) + 0.5 - my);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  // size grows with the square root of the area: 0.8 cell for a lone cell, up to 3 cells
  const size = Math.max(0.8, Math.min(3, 0.45 * Math.sqrt(cells.length)));
  return { x: (best % W) + 0.5, y: Math.floor(best / W) + 0.5, size };
}
