import rough from "roughjs";
import type { Drawable } from "roughjs/bin/core";
import { CONTESTED_GAP_PCT, COOLDOWN_MINUTES, GARRISON_MEDIUM, GARRISON_STRONG, GRID_H, GRID_W } from "@config/game";
import { FACTION_BY_ID, type FactionId } from "@/lib/factions";
import { STATIC_CELLS, cellId, isPlayable } from "./layout";
import { WATCHTOWER_CELLS } from "./mask";
import { inZone, rankedForces, type CellState, type GameEvent } from "./state";
import { computeZones, type Pt } from "./zones";

// ---------------------------------------------------------------------------
// World geometry (world units; the canvas transform does the zoom).
// The map is the illustration public/map/world@4x.webp, exactly 48 × 30 cells.
// ---------------------------------------------------------------------------
export const CELL = 32;
export const WORLD_W = GRID_W * CELL;
export const WORLD_H = GRID_H * CELL;
export const cx = (x: number) => x * CELL;
export const cy = (y: number) => y * CELL;

export const INK = "#2A1F14";
export const PARCH = "#E6D8B8";
export const GOLD = "#C9A24B";
export const BLOOD = "#8E1B1B";
export const CHARCOAL = "#141210";

export interface Fonts {
  cinzel: string;
  fell: string;
  mono: string;
}

export function worldToCell(wx: number, wy: number): number | null {
  const x = Math.floor(wx / CELL);
  const y = Math.floor(wy / CELL);
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return null;
  return cellId(x, y);
}

type Ctx = CanvasRenderingContext2D;
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
function ink(ctx: Ctx, width = 0.9, alpha = 0.85) {
  ctx.strokeStyle = rgba(INK, alpha);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

// ---------------------------------------------------------------------------
// Decor drawn over the illustration: watchtowers, place names in IM Fell English, the
// season cartouche and the compass rose. Redrawn LIVE at every zoom level (vector strokes
// and text stay crisp); only the rough.js shapes are generated once.
// ---------------------------------------------------------------------------
export interface Decor {
  rough: Drawable[];
}

export function buildDecor(): Decor {
  const gen = rough.generator();
  const out: Drawable[] = [];
  for (const [tx, ty] of WATCHTOWER_CELLS) {
    const seed = cellId(tx, ty) + 1;
    const x = cx(tx) + CELL / 2;
    const by = cy(ty) + CELL - 4;
    out.push(
      gen.polygon(
        [
          [x - 7, by],
          [x - 5, by - 16],
          [x + 5, by - 16],
          [x + 7, by],
        ],
        { seed, stroke: INK, strokeWidth: 1.1, fill: PARCH, fillStyle: "solid", roughness: 0.7 },
      ),
      gen.polygon(
        [
          [x - 7, by - 16],
          [x - 7, by - 21],
          [x - 4, by - 21],
          [x - 4, by - 19],
          [x - 1, by - 19],
          [x - 1, by - 21],
          [x + 2, by - 21],
          [x + 2, by - 19],
          [x + 4, by - 19],
          [x + 4, by - 21],
          [x + 7, by - 21],
          [x + 7, by - 16],
        ],
        { seed: seed + 1, stroke: INK, strokeWidth: 1, fill: PARCH, fillStyle: "solid", roughness: 0.5 },
      ),
    );
  }
  const { x, y, w, h } = CARTOUCHE;
  out.push(
    gen.rectangle(x, y, w, h, { seed: 9001, stroke: INK, strokeWidth: 1.4, fill: "#efe4c8", fillStyle: "solid", roughness: 0.8 }),
    gen.rectangle(x + 4, y + 4, w - 8, h - 8, { seed: 9002, stroke: INK, strokeWidth: 0.6, roughness: 0.8 }),
  );
  return { rough: out };
}

export function drawDecor(ctx: Ctx, decor: Decor, fonts: Fonts, seasonTitle: string, seasonSub: string) {
  const rc = rough.canvas(ctx.canvas);
  for (const d of decor.rough) rc.draw(d);
  drawTowerDetails(ctx);
  drawPlaceNames(ctx, fonts);
  drawCartouche(ctx, fonts, seasonTitle, seasonSub);
  drawCompass(ctx, fonts);
}

function drawTowerDetails(ctx: Ctx) {
  for (const [tx, ty] of WATCHTOWER_CELLS) {
    const x = cx(tx) + CELL / 2;
    const by = cy(ty) + CELL - 4;
    ctx.beginPath();
    ink(ctx, 0.6, 0.7);
    for (let i = 0; i < 4; i++) {
      ctx.moveTo(x + 1 + i * 1.3, by - 14);
      ctx.lineTo(x + 2 + i * 1.5, by - 1);
    }
    ctx.rect(x - 1.2, by - 11, 2.4, 4);
    ctx.moveTo(x, by - 21);
    ctx.lineTo(x, by - 28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, by - 28);
    ctx.lineTo(x + 7, by - 26);
    ctx.lineTo(x, by - 24);
    ctx.fillStyle = BLOOD;
    ctx.fill();
  }
}

/** Lettering written straight onto the map, with a thin parchment halo so it stays legible. */
function letter(ctx: Ctx, text: string, x: number, y: number, size: number, font: string, opts: { rot?: number; italic?: boolean; spacing?: number } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(opts.rot ?? 0);
  ctx.font = `${opts.italic === false ? "" : "italic "}${size}px ${font}`;
  if ("letterSpacing" in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${opts.spacing ?? 0.5}px`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.28;
  ctx.strokeStyle = "rgba(236,222,190,0.78)";
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = rgba(INK, 0.92);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Place names (world cells), set where the illustration draws each place. */
export const PLACE_NAMES: { text: string; x: number; y: number; size: number; rot?: number }[] = [
  { text: "The Gnawing Pits", x: 15.6, y: 9.4, size: 19 },
  { text: "The Weeping Barrows", x: 38.2, y: 8.4, size: 19 },
  { text: "The Cradle Fen", x: 9.6, y: 21.6, size: 19 },
  { text: "The Burnt Fields", x: 37.6, y: 24.2, size: 19 },
  { text: "Knave's Hollow", x: 24.6, y: 17.35, size: 16 },
  { text: "River Wend", x: 25.6, y: 5.6, size: 14, rot: -Math.PI / 2.35 },
  { text: "the Weir", x: 17.4, y: 14.8, size: 12, rot: -Math.PI / 2 },
  { text: "the Mourning Reach", x: 30.5, y: 14.6, size: 12, rot: Math.PI / 2 },
  { text: "Ashen March", x: 8.2, y: 12.4, size: 15 },
  { text: "Crowfeeder Moor", x: 40.6, y: 13.6, size: 15 },
  { text: "The Grey Deep", x: 40.5, y: 0.75, size: 17 },
  { text: "Sorrow Sound", x: 16.5, y: 28.8, size: 15 },
];

function drawPlaceNames(ctx: Ctx, fonts: Fonts) {
  for (const p of PLACE_NAMES) letter(ctx, p.text, cx(p.x), cy(p.y), p.size, fonts.fell, { rot: p.rot });
}

/** bottom-left, over the open sea */
const CARTOUCHE = { x: 14, y: WORLD_H - 74, w: 268, h: 58 };

function drawCartouche(ctx: Ctx, fonts: Fonts, title: string, sub: string) {
  const { x, y, w, h } = CARTOUCHE;
  for (const side of [-1, 1]) {
    const sx = side < 0 ? x : x + w;
    ctx.beginPath();
    ink(ctx, 1.1, 0.9);
    for (let a = 0; a < Math.PI * 3.2; a += 0.15) {
      const r = 1.5 + a * 1.3;
      const px = sx + side * (Math.cos(a) * r - 3);
      const py = y + h / 2 + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 17px ${fonts.cinzel}`;
  ctx.fillText(title.toUpperCase(), x + w / 2, y + 23);
  ctx.font = `italic 11px ${fonts.fell}`;
  ctx.fillStyle = rgba(INK, 0.85);
  ctx.fillText(sub, x + w / 2, y + 42);
}

function drawCompass(ctx: Ctx, fonts: Fonts) {
  // bottom-right, over the open sea
  const x = WORLD_W - 52;
  const y = WORLD_H - 50;
  const r = 28;
  ctx.fillStyle = "rgba(236,222,190,0.55)";
  ctx.beginPath();
  ctx.arc(x, y, r + 2, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, 0.8, 0.9);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r - 4, 0, Math.PI * 2);
  ctx.stroke();
  const point = (a: number, len: number, wid: number) => {
    const tip = [x + Math.cos(a) * len, y + Math.sin(a) * len];
    const l = [x + Math.cos(a - Math.PI / 2) * wid, y + Math.sin(a - Math.PI / 2) * wid];
    const rr = [x + Math.cos(a + Math.PI / 2) * wid, y + Math.sin(a + Math.PI / 2) * wid];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tip[0], tip[1]);
    ctx.lineTo(l[0], l[1]);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tip[0], tip[1]);
    ctx.lineTo(rr[0], rr[1]);
    ctx.closePath();
    ctx.fillStyle = PARCH;
    ctx.fill();
    ink(ctx, 0.7, 1);
    ctx.stroke();
  };
  for (let i = 0; i < 4; i++) point(Math.PI / 4 + (i * Math.PI) / 2, r * 0.6, 3.5);
  for (let i = 0; i < 4; i++) point(-Math.PI / 2 + (i * Math.PI) / 2, r + 6, 5);
  letter(ctx, "N", x, y - r - 11, 12, fonts.cinzel, { italic: false });
}

// ---------------------------------------------------------------------------
// Territories, in the style of an old hand-coloured map (SPEC.md):
//  - a watercolour band ~12 px wide along the INSIDE of the whole contour (coasts
//    included), with slightly irregular edges, fading towards the centre — multiply,
//    45 % at most; no fill in the middle;
//  - a thin dotted frontier (~1.5 px) in a dark shade of the Banner's colour, never
//    along the coasts;
//  - zones under 3 cells: no frontier, only a small pennant;
//  - small crests on the large zones only.
// The geometry and the watercolour layer are built ONCE per change of owners; the dotted
// line and the markers are drawn live so they keep their screen size.
// ---------------------------------------------------------------------------
export const FRONTIER_PX = 1.5;
const BAND_WIDTH = 18; // world units ≈ 12 screen px at the overview zoom
const BAND_MAX_ALPHA = 0.45;
const BAND_STEPS = 7;
const BAND_JITTER = 3.2; // world units: the irregular inner edge
export const MIN_ZONE_CELLS = 3;
export const CREST_MIN_CELLS = 14;

export interface ZoneShape {
  owner: FactionId;
  cells: number;
  /** dotted frontier: open runs of the smoothed contour, never along the water (empty for small zones) */
  frontier: Path2D;
  /** smoothed rings in world units, for the watercolour band (coasts included) */
  rings: Pt[][];
  /** the zone's area (all rings, even-odd), to keep the band inside */
  area: Path2D;
  marker: { kind: "crest" | "pennant" | "none"; x: number; y: number; size: number };
}

export interface TerritoryGeometry {
  key: string;
  zones: ZoneShape[];
}

let landClip: Path2D | null = null;
/** Union of the playable cells: every stroke and band is clipped to it. */
export function landPath(): Path2D {
  if (landClip) return landClip;
  landClip = new Path2D();
  for (const c of STATIC_CELLS) if (c.terrain !== "water") landClip.rect(cx(c.x), cy(c.y), CELL, CELL);
  return landClip;
}

/** Owners of the playable cells, as a string: the geometry is rebuilt only when it changes. */
export const ownersKey = (cells: CellState[]) =>
  cells.map((c) => (STATIC_CELLS[c.id].terrain === "water" || !c.owner ? "." : c.owner[0])).join("");

/** A darker shade of a Banner colour, for the dotted frontier. */
export function darkShade(hex: string, k = 0.45) {
  const n = parseInt(hex.slice(1), 16);
  const d = (v: number) => Math.round(v * (1 - k));
  return `rgb(${d(n >> 16)},${d((n >> 8) & 255)},${d(n & 255)})`;
}

export function buildTerritoryGeometry(cells: CellState[]): TerritoryGeometry {
  const owners = new Array<FactionId | null>(GRID_W * GRID_H).fill(null);
  for (const c of cells) owners[c.id] = c.owner;
  const zones = computeZones(owners, isPlayable).map((z): ZoneShape => {
    const small = z.cells.length < MIN_ZONE_CELLS;
    const frontier = new Path2D();
    const area = new Path2D();
    const rings: Pt[][] = [];
    for (const ring of z.rings) {
      const n = ring.points.length;
      const P = ring.points.map(([x, y]) => [x * CELL, y * CELL] as Pt);
      rings.push(P);
      area.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < n; i++) area.lineTo(P[i][0], P[i][1]);
      area.closePath();
      if (small) continue;
      // frontier runs: start after a water segment so a run never wraps around index 0
      const firstWater = ring.frontier.findIndex((f) => !f);
      if (firstWater === -1) {
        frontier.moveTo(P[0][0], P[0][1]);
        for (let i = 1; i < n; i++) frontier.lineTo(P[i][0], P[i][1]);
        frontier.closePath();
        continue;
      }
      let drawing = false;
      for (let k = 1; k <= n; k++) {
        const i = (firstWater + k) % n;
        const a = P[i];
        const b = P[(i + 1) % n];
        if (ring.frontier[i]) {
          if (!drawing) frontier.moveTo(a[0], a[1]);
          frontier.lineTo(b[0], b[1]);
          drawing = true;
        } else drawing = false;
      }
    }
    const marker: ZoneShape["marker"] = small
      ? { kind: "pennant", x: z.crest.x * CELL, y: z.crest.y * CELL, size: CELL * 0.75 }
      : z.cells.length >= CREST_MIN_CELLS
        ? {
            kind: "crest",
            x: z.crest.x * CELL,
            y: z.crest.y * CELL,
            size: CELL * Math.max(0.9, Math.min(1.6, 0.28 * Math.sqrt(z.cells.length))),
          }
        : { kind: "none", x: 0, y: 0, size: 0 };
    return { owner: z.owner, cells: z.cells.length, frontier, area, rings: small ? [] : rings, marker };
  });
  return { key: ownersKey(cells), zones };
}

/** Smooth pseudo-noise in [-1, 1] along a ring, stable from one load to the next. */
const wobble = (s: number, seed: number) =>
  (Math.sin(s * 0.083 + seed) + 0.6 * Math.sin(s * 0.211 + seed * 2.3) + 0.35 * Math.sin(s * 0.47 + seed * 0.7)) / 1.95;

/** A ring pushed along its normals by the noise: irregular watercolour edges. */
function jitteredRing(P: Pt[], amp: number, seed: number): Path2D {
  const n = P.length;
  const path = new Path2D();
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const p = P[i % n];
    const prev = P[(i - 1 + n) % n];
    const next = P[(i + 1) % n];
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    if (i > 0) s += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    const d = amp * wobble(s, seed);
    const x = p[0] + (-ty / len) * d;
    const y = p[1] + (tx / len) * d;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  return path;
}

/** Cached layer: the watercolour bands (composited with "multiply"). */
export function drawTerritory(canvas: HTMLCanvasElement, R: number, geo: TerritoryGeometry) {
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(R, 0, 0, R, 0, 0);
  // BAND_STEPS passes of equal opacity add up to BAND_MAX_ALPHA right on the contour
  const stepAlpha = 1 - Math.pow(1 - BAND_MAX_ALPHA, 1 / BAND_STEPS);
  const land = landPath();
  geo.zones.forEach((z, zi) => {
    if (!z.rings.length) return;
    const colour = FACTION_BY_ID[z.owner].color;
    ctx.save();
    ctx.clip(z.area, "evenodd");
    ctx.clip(land);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (let k = BAND_STEPS; k >= 1; k--) {
      ctx.strokeStyle = rgba(colour, stepAlpha);
      // each pass is a little narrower and wobbles differently: a soft, uneven inner edge
      ctx.lineWidth = (2 * BAND_WIDTH * k) / BAND_STEPS;
      for (const [ri, ring] of z.rings.entries()) ctx.stroke(jitteredRing(ring, BAND_JITTER, zi * 13.7 + ri * 3.1 + k * 1.9));
    }
    // pigment pooling right along the edge, as watercolour dries
    ctx.strokeStyle = rgba(colour, 0.22);
    ctx.lineWidth = 3;
    for (const [ri, ring] of z.rings.entries()) ctx.stroke(jitteredRing(ring, 0.8, zi * 5.3 + ri));
    ctx.restore();
  });
}

// ---------------------------------------------------------------------------
// Levels of detail, by the on-screen size of a cell (CSS px):
//   overview  — frontiers and crests only (pennants for the very small zones);
//   medium    — + crossed swords, only on cells really disputed (top two within 10 %);
//   close     — + garrison pawns, only on held cells, never on neutral ones.
// Pawns and swords are engraved in sepia ink (INK), thin and small, at a constant screen size.
// ---------------------------------------------------------------------------
export const SWORDS_FROM_PX = 34;
export const PAWNS_FROM_PX = 58;
export type Detail = "overview" | "medium" | "close";
export const detailAt = (cellPx: number): Detail =>
  cellPx >= PAWNS_FROM_PX ? "close" : cellPx >= SWORDS_FROM_PX ? "medium" : "overview";

/** On-screen sizes (CSS px) of the engraved marks. */
const PENNANT_PX = 17;
const SWORDS_PX = 13;
const PAWN_PX = 9;

/** A cell is really disputed when at least two Banners stand on it within CONTESTED_GAP_PCT. */
export function trulyContested(c: CellState): boolean {
  const r = rankedForces(c);
  if (r.length < 2 || r[1].force <= 0) return false;
  return (r[0].force - r[1].force) / r[0].force < CONTESTED_GAP_PCT / 100;
}

type Box = { x0: number; y0: number; x1: number; y1: number };
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Where a pennant stands (world units) for a given screen scale: its bounding box. */
function pennantBox(x: number, y: number, px: number): Box {
  const size = PENNANT_PX * px;
  const bx = x - size * 0.15;
  const by = y + size * 0.45;
  return { x0: bx - 1.5 * px, y0: by - size * 1.08, x1: bx + size * 0.64, y1: by + px };
}

function pennant(ctx: Ctx, x: number, y: number, colour: string, px: number) {
  const size = PENNANT_PX * px;
  const pole = size;
  const bx = x - size * 0.15;
  const by = y + size * 0.45;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(bx, by - pole);
  ctx.lineTo(bx + size * 0.62, by - pole + size * 0.17);
  ctx.lineTo(bx + size * 0.2, by - pole + size * 0.28);
  ctx.lineTo(bx + size * 0.5, by - pole + size * 0.42);
  ctx.lineTo(bx, by - pole + size * 0.48);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.strokeStyle = rgba(INK, 0.9);
  ctx.lineWidth = 0.9 * px;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx, by - pole - size * 0.06);
  ctx.lineWidth = 1.2 * px;
  ctx.stroke();
}

/** Boxes taken by the territory markers (pennants and crests) at this scale: swords keep clear of them. */
function markerBoxes(geo: TerritoryGeometry, crests: Partial<Record<FactionId, HTMLImageElement>>, px: number): Box[] {
  const out: Box[] = [];
  for (const z of geo.zones) {
    const m = z.marker;
    if (m.kind === "pennant") out.push(pennantBox(m.x, m.y, px));
    else if (m.kind === "crest") {
      const img = crests[z.owner];
      const w = img && img.naturalWidth ? (img.naturalWidth / img.naturalHeight) * m.size : m.size * 0.86;
      out.push({ x0: m.x - w / 2, y0: m.y - m.size / 2, x1: m.x + w / 2, y1: m.y + m.size / 2 });
    }
  }
  return out;
}

/** Live part of the territories: dotted frontiers, crests and pennants. */
function drawTerritoryMarks(
  ctx: Ctx,
  geo: TerritoryGeometry,
  scale: number,
  crests: Partial<Record<FactionId, HTMLImageElement>>,
) {
  if (!geo.zones.length) return;
  const px = 1 / scale;
  ctx.save();
  ctx.clip(landPath());
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = FRONTIER_PX * px;
  ctx.setLineDash([3 * px, 3 * px]);
  for (const z of geo.zones) {
    if (z.cells < MIN_ZONE_CELLS) continue;
    ctx.strokeStyle = darkShade(FACTION_BY_ID[z.owner].color);
    ctx.stroke(z.frontier);
  }
  ctx.restore();
  for (const z of geo.zones) {
    const m = z.marker;
    if (m.kind === "pennant") pennant(ctx, m.x, m.y, FACTION_BY_ID[z.owner].color, px);
    else if (m.kind === "crest") {
      const img = crests[z.owner];
      if (!img || !img.complete || !img.naturalWidth) continue;
      const w = (img.naturalWidth / img.naturalHeight) * m.size;
      ctx.drawImage(img, m.x - w / 2, m.y - m.size / 2, w, m.size);
    }
  }
}

// ---------------------------------------------------------------------------
// Garrisons: 1 pawn for a weak garrison, 2 for a medium one, 3 for a strong one
// (thresholds in config/game.ts). Drawn live, close up only.
// ---------------------------------------------------------------------------
export function garrisonLevel(total: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  if (total >= GARRISON_STRONG) return 3;
  if (total >= GARRISON_MEDIUM) return 2;
  return 1;
}
const totalOf = (c: CellState) => Object.values(c.forces).reduce((s, v) => s + (v ?? 0), 0);

/**
 * An engraved pawn: outline only, a little cross-hatching on the shadow side, no fill.
 * (x, by) = centre of its base; h = height in world units.
 */
function engravedPawn(ctx: Ctx, x: number, by: number, h: number) {
  const r = h * 0.17;
  const hy = by - h + r;
  ctx.beginPath();
  ctx.arc(x, hy, r, 0, Math.PI * 2);
  // collar
  ctx.moveTo(x - h * 0.2, hy + r * 1.35);
  ctx.lineTo(x + h * 0.2, hy + r * 1.35);
  // body, flaring to the base
  ctx.moveTo(x - h * 0.12, hy + r * 1.35);
  ctx.quadraticCurveTo(x - h * 0.13, by - h * 0.22, x - h * 0.3, by - h * 0.07);
  ctx.lineTo(x - h * 0.3, by);
  ctx.lineTo(x + h * 0.3, by);
  ctx.lineTo(x + h * 0.3, by - h * 0.07);
  ctx.quadraticCurveTo(x + h * 0.13, by - h * 0.22, x + h * 0.12, hy + r * 1.35);
  ctx.stroke();
  // hatching on the right (shadow) side
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const yy = by - h * (0.12 + k * 0.13);
    ctx.moveTo(x + h * 0.06, yy);
    ctx.lineTo(x + h * (0.17 + k * 0.01), yy - h * 0.06);
  }
  ctx.stroke();
}

/** Pawn offsets (in pawn heights) for 1, 2 or 3 pawns, centred on the cell's lower half. */
function pawnSpots(level: number): [number, number][] {
  if (level === 1) return [[0, 0]];
  if (level === 2) return [[-0.42, 0], [0.42, 0]];
  return [[-0.75, 0.08], [0, -0.06], [0.75, 0.08]];
}

function drawGarrison(ctx: Ctx, id: number, level: number, h: number) {
  const x0 = cx(id % GRID_W) + CELL / 2;
  const y0 = cy(Math.floor(id / GRID_W)) + CELL * 0.8;
  for (const [dx, dy] of pawnSpots(level)) engravedPawn(ctx, x0 + dx * h, y0 + dy * h, h);
}

/** Two small crossed swords, engraved: thin blades, guards and pommels, no fill. (x, y) = centre. */
function crossedSwords(ctx: Ctx, x: number, y: number, s: number, px: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = rgba(INK, 0.95);
  for (const dir of [1, -1]) {
    ctx.save();
    ctx.rotate((dir * Math.PI) / 4);
    ctx.lineWidth = 0.85 * px;
    ctx.beginPath();
    // blade: a long narrow outline with its fuller
    ctx.moveTo(0, -s * 0.6);
    ctx.lineTo(s * 0.06, -s * 0.48);
    ctx.lineTo(s * 0.06, s * 0.2);
    ctx.moveTo(0, -s * 0.6);
    ctx.lineTo(-s * 0.06, -s * 0.48);
    ctx.lineTo(-s * 0.06, s * 0.2);
    ctx.moveTo(0, -s * 0.44);
    ctx.lineTo(0, s * 0.14);
    // guard
    ctx.moveTo(-s * 0.22, s * 0.21);
    ctx.lineTo(s * 0.22, s * 0.21);
    // grip
    ctx.moveTo(0, s * 0.22);
    ctx.lineTo(0, s * 0.42);
    ctx.stroke();
    // pommel
    ctx.beginPath();
    ctx.arc(0, s * 0.47, s * 0.05, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** Picks a corner of the cell for the swords, clear of any pennant or crest; null if none is free. */
function swordSpot(id: number, size: number, markers: Box[]): [number, number] | null {
  const x = cx(id % GRID_W);
  const y = cy(Math.floor(id / GRID_W));
  const h = size / 2 + 1;
  const spots: [number, number][] = [
    [x + CELL - h, y + h],
    [x + h, y + h],
    [x + CELL - h, y + CELL - h],
    [x + h, y + CELL - h],
  ];
  for (const [sx, sy] of spots) {
    const box = { x0: sx - h, y0: sy - h, x1: sx + h, y1: sy + h };
    if (!markers.some((m) => overlaps(m, box))) return [sx, sy];
  }
  return null;
}

/** The hovered cell, and its neighbours (their marks share the repainted margin). */
export function hoverArea(id: number | null): number[] {
  return id === null ? [] : [id];
}

// ---------------------------------------------------------------------------
// Overlay: filters, frontiers, my cells, swords, events, pawns, hover and selection.
// Lists are built once per data change, never per frame.
// ---------------------------------------------------------------------------
export type MapFilter = "all" | "mine" | "contested" | "events";

export interface OverlayIndex {
  contested: number[];
  /** cells held by a Banner with soldiers on them, and their garrison level */
  garrisons: [number, number][];
  mine: number[];
  /**
   * The filter veil: one uniform shade over the whole map with the matching cells cut
   * out (null = no filter, or nothing matches — then nothing is dimmed).
   */
  veil: Path2D | null;
  /** cells matching the active filter (null when no filter is active) */
  matches: number | null;
  events: GameEvent[];
}

/** Cells matching a filter (land only). Shared by the map veil and the "nothing here" message. */
export function filterMatches(cells: CellState[], events: GameEvent[], filter: MapFilter, now: number): number[] {
  if (filter === "all") return [];
  const land = cells.filter((c) => STATIC_CELLS[c.id]?.terrain !== "water");
  if (filter === "mine") return land.filter((c) => c.mine > 0).map((c) => c.id);
  if (filter === "contested") return land.filter(trulyContested).map((c) => c.id);
  const active = events.filter((e) => e.zone && e.endsAt > now);
  return land.filter((c) => active.some((e) => inZone(c.id % GRID_W, Math.floor(c.id / GRID_W), e.zone))).map((c) => c.id);
}

export function buildOverlayIndex(cells: CellState[], events: GameEvent[], filter: MapFilter, now: number): OverlayIndex {
  const active = events.filter((e) => e.zone && e.endsAt > now);
  const contested: number[] = [];
  const garrisons: [number, number][] = [];
  const mine: number[] = [];
  for (const c of cells) {
    if (STATIC_CELLS[c.id]?.terrain === "water") continue;
    if (trulyContested(c)) contested.push(c.id);
    if (c.owner) {
      const level = garrisonLevel(totalOf(c));
      if (level) garrisons.push([c.id, level]);
    }
    if (c.mine > 0) mine.push(c.id);
  }
  let veil: Path2D | null = null;
  let matches: number | null = null;
  if (filter !== "all") {
    const keep = filterMatches(cells, events, filter, now);
    matches = keep.length;
    if (keep.length) {
      // the whole map, minus the matching cells (even-odd): one fill, no seams
      veil = new Path2D();
      veil.rect(0, 0, WORLD_W, WORLD_H);
      for (const id of keep) veil.rect(cx(id % GRID_W), cy(Math.floor(id / GRID_W)), CELL, CELL);
    }
  }
  return { contested, garrisons, mine, veil, matches, events: active };
}

export interface OverlayInput {
  cells: CellState[];
  index: OverlayIndex;
  territory: TerritoryGeometry;
  selectedId: number | null;
  hoverId: number | null;
  now: number;
  fonts: Fonts;
  crests: Partial<Record<FactionId, HTMLImageElement>>;
  /** screen px per world unit — keeps strokes legible and picks the level of detail */
  scale: number;
  /** visible part of the world: marks outside it are skipped */
  view: { x0: number; y0: number; x1: number; y1: number };
}

const inView = (id: number, v: OverlayInput["view"]) => {
  const x = cx(id % GRID_W);
  const y = cy(Math.floor(id / GRID_W));
  return x + CELL >= v.x0 && x <= v.x1 && y + CELL >= v.y0 && y <= v.y1;
};

/**
 * Draws the overlay. With `only`, per-cell marks are limited to those cells
 * (the caller has clipped the canvas to them).
 */
export function drawOverlay(ctx: Ctx, o: OverlayInput, t: number, only?: Set<number>) {
  const { cells, index, now, fonts } = o;
  const px = 1 / o.scale; // one screen pixel in world units
  const detail = detailAt(CELL * o.scale);
  const pick = (ids: number[]) => ids.filter((i) => (only ? only.has(i) : true) && inView(i, o.view));

  drawTerritoryMarks(ctx, o.territory, o.scale, o.crests);

  if (index.veil) {
    ctx.fillStyle = "rgba(20,18,16,0.5)";
    ctx.fill(index.veil, "evenodd");
  }

  // my cells: a thin gold liseré
  const mine = pick(index.mine);
  if (mine.length) {
    ctx.beginPath();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1.3, 1.2 * px);
    for (const id of mine) ctx.rect(cx(id % GRID_W) + 1.2, cy(Math.floor(id / GRID_W)) + 1.2, CELL - 2.4, CELL - 2.4);
    ctx.stroke();
  }

  // medium zoom and closer: crossed swords on the cells really disputed, clear of the pennants
  if (detail !== "overview") {
    const size = SWORDS_PX * px;
    const markers = markerBoxes(o.territory, o.crests, px);
    for (const id of pick(index.contested)) {
      const spot = swordSpot(id, size, markers);
      if (spot) crossedSwords(ctx, spot[0], spot[1], size, px);
    }
  }

  // close up: the garrisons, engraved in sepia; my fresh soldiers in wet iron-gall ink
  if (detail === "close") {
    const h = PAWN_PX * px;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 0.8 * px;
    ctx.strokeStyle = rgba(INK, 0.92);
    const wet: [number, number, number][] = [];
    for (const [id, level] of index.garrisons) {
      if ((only && !only.has(id)) || !inView(id, o.view)) continue;
      const c = cells[id];
      const w = c.mine > 0 && c.wetUntil && c.wetUntil > now ? (c.wetUntil - now) / (COOLDOWN_MINUTES * 60_000) : 0;
      if (w > 0) wet.push([id, level, w]);
      else drawGarrison(ctx, id, level, h);
    }
    for (const [id, level, w] of wet) {
      ctx.strokeStyle = `rgb(${Math.round(18 + 24 * (1 - w))},${Math.round(22 + 9 * (1 - w))},${Math.round(58 - 38 * (1 - w))})`;
      ctx.lineWidth = (0.8 + 0.4 * w) * px;
      drawGarrison(ctx, id, level, h);
    }
  }

  for (const e of index.events) {
    const z = e.zone!;
    const live = e.startsAt <= now;
    const color = e.type === "tithe" ? GOLD : BLOOD;
    const x = cx(z.x);
    const y = cy(z.y);
    const w = z.w * CELL;
    const h = z.h * CELL;
    if (e.type === "tithe" && live) {
      ctx.fillStyle = rgba(GOLD, 0.13);
      ctx.fillRect(x, y, w, h);
    }
    ctx.save();
    ctx.setLineDash(live ? [8, 4] : [4, 5]);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = color;
    ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
    ctx.restore();
    const remain = (live ? e.endsAt : e.startsAt) - now;
    const hh = Math.floor(remain / 3_600_000);
    const mm = Math.floor((remain % 3_600_000) / 60_000);
    const name = e.type === "tithe" ? "THE TITHE · ×3" : e.type === "plague" ? "THE PLAGUE" : "THE RUSH";
    const when = live ? `ends in ${hh}h ${mm}m` : `comes in ${hh}h ${mm}m`;
    ctx.font = `600 10px ${fonts.cinzel}`;
    const tw = Math.max(ctx.measureText(name).width, 70) + 14;
    const lx = x + w / 2 - tw / 2;
    const ly = y - 30;
    ctx.fillStyle = "#efe4c8";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.fillRect(lx, ly, tw, 26);
    ctx.strokeRect(lx, ly, tw, 26);
    ctx.fillStyle = e.type === "tithe" ? INK : BLOOD;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, x + w / 2, ly + 9);
    ctx.font = `italic 10px ${fonts.fell}`;
    ctx.fillStyle = INK;
    ctx.fillText(when, x + w / 2, ly + 19);
  }

  // the grid: only on the hovered cell
  if (o.hoverId !== null && o.hoverId !== o.selectedId && (!only || only.has(o.hoverId)) && isPlayable(o.hoverId % GRID_W, Math.floor(o.hoverId / GRID_W))) {
    ctx.strokeStyle = rgba(INK, 0.75);
    ctx.lineWidth = 1.1 * px;
    ctx.strokeRect(cx(o.hoverId % GRID_W), cy(Math.floor(o.hoverId / GRID_W)), CELL, CELL);
  }
  if (o.selectedId !== null && (!only || only.has(o.selectedId))) {
    const x = cx(o.selectedId % GRID_W);
    const y = cy(Math.floor(o.selectedId / GRID_W));
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2.5, 2 * px);
    ctx.strokeRect(x - 1, y - 1, CELL + 2, CELL + 2);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1, px);
    ctx.strokeRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3);
    ctx.beginPath();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, 1.2 * px);
    const k = 6;
    for (const [ax, ay, dx, dy] of [
      [x - 4, y - 4, 1, 1],
      [x + CELL + 4, y - 4, -1, 1],
      [x - 4, y + CELL + 4, 1, -1],
      [x + CELL + 4, y + CELL + 4, -1, -1],
    ]) {
      ctx.moveTo(ax, ay + dy * k);
      ctx.lineTo(ax, ay);
      ctx.lineTo(ax + dx * k, ay);
    }
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Animations (SPEC "Animations"), drawn over the final state, only on their cells:
//   deploy   — pawns drawn with the quill (~400 ms)
//   conquest — the old colour burns away from the edges, then the new colour flashes
//   retreat  — the soldiers are struck through with a pen stroke and the wash fades
// ---------------------------------------------------------------------------
export type AnimKind = "deploy" | "conquest" | "retreat";
export interface CellAnim {
  cell: number;
  kind: AnimKind;
  from: FactionId | null;
  to: FactionId | null;
  start: number;
}
export const ANIM_MS: Record<AnimKind, number> = { deploy: 1200, conquest: 1600, retreat: 1000 };

const total = (c: CellState) => Object.values(c.forces).reduce((s, v) => s + (v ?? 0), 0);

/** Compares two snapshots and returns the animations to play. */
export function diffAnimations(prev: CellState[], next: CellState[], now: number): CellAnim[] {
  const out: CellAnim[] = [];
  for (let i = 0; i < next.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (!a || !b || STATIC_CELLS[i].terrain === "water") continue;
    const ta = total(a);
    const tb = total(b);
    if (a.owner !== b.owner && a.owner && b.owner) out.push({ cell: i, kind: "conquest", from: a.owner, to: b.owner, start: now });
    else if (tb > ta) out.push({ cell: i, kind: "deploy", from: a.owner, to: b.owner, start: now });
    else if (tb < ta) out.push({ cell: i, kind: "retreat", from: a.owner, to: b.owner, start: now });
  }
  // a season reset or a first load is not a battle: no animation storm
  return out.length > 40 ? [] : out;
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function pawns(ctx: Ctx, cx0: number, cy0: number, reveal: number) {
  // the quill draws from left to right
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx0 - CELL / 2, cy0 - CELL / 2, CELL * reveal, CELL);
  ctx.clip();
  ink(ctx, 0.9, 0.95);
  engravedPawn(ctx, cx0 - 7, cy0 + 10, 9);
  engravedPawn(ctx, cx0, cy0 + 8, 10);
  engravedPawn(ctx, cx0 + 7, cy0 + 10, 9);
  ctx.restore();
}

export function drawAnimations(ctx: Ctx, anims: CellAnim[], now: number): CellAnim[] {
  const alive: CellAnim[] = [];
  for (const a of anims) {
    const dt = now - a.start;
    const dur = ANIM_MS[a.kind];
    if (dt >= dur) continue;
    alive.push(a);
    const x = cx(a.cell % GRID_W);
    const y = cy(Math.floor(a.cell / GRID_W));
    const mx = x + CELL / 2;
    const my = y + CELL / 2;

    if (a.kind === "deploy") {
      ctx.globalAlpha = dt < 900 ? 1 : 1 - (dt - 900) / 300;
      pawns(ctx, mx, my, Math.min(1, dt / 400));
      ctx.globalAlpha = 1;
    } else if (a.kind === "conquest") {
      // the old colour burns from the edges inward, then the new frontier stands
      const burn = dt / 900;
      if (burn < 1 && a.from) {
        const inset = ease(burn) * (CELL / 2);
        ctx.fillStyle = rgba(FACTION_BY_ID[a.from].color, 0.45 * (1 - burn));
        ctx.fillRect(x + inset, y + inset, CELL - inset * 2, CELL - inset * 2);
        ctx.strokeStyle = `rgba(120,40,10,${0.85 * (1 - burn)})`;
        ctx.lineWidth = 2.2;
        ctx.strokeRect(x + inset, y + inset, CELL - inset * 2, CELL - inset * 2);
        ctx.strokeStyle = `rgba(230,120,40,${0.6 * (1 - burn)})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + inset + 1.2, y + inset + 1.2, CELL - inset * 2 - 2.4, CELL - inset * 2 - 2.4);
      } else if (a.to) {
        // the new Banner's colour flashes once on the cell
        ctx.fillStyle = rgba(FACTION_BY_ID[a.to].color, 0.35 * (1 - ease((dt - 900) / 700)));
        ctx.fillRect(x, y, CELL, CELL);
      }
    } else {
      // retreat: soldiers struck through, the wash fades
      const t = dt / dur;
      if (a.from && !a.to) {
        ctx.fillStyle = rgba(FACTION_BY_ID[a.from].color, 0.3 * (1 - ease(t)));
        ctx.fillRect(x, y, CELL, CELL);
      }
      ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      pawns(ctx, mx, my, 1);
      const k = ease(dt / 350);
      ink(ctx, 1.6, 0.95);
      ctx.beginPath();
      ctx.moveTo(x + 4, y + CELL - 8);
      ctx.quadraticCurveTo(mx, my + 2, x + 4 + (CELL - 8) * k, y + CELL - 8 - (CELL - 16) * k);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  return alive;
}
