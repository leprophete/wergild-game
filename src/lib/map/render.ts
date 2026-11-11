import rough from "roughjs";
import { COOLDOWN_MINUTES, GRID_H, GRID_W, MAX_FORCE_PER_CELL } from "@config/game";
import { FACTIONS, FACTION_BY_ID, type FactionId } from "@/lib/factions";
import { hash2, mulberry32 } from "@/lib/rng";
import {
  BRIDGES,
  FORK_BOTTOM,
  FORK_TOP,
  STATIC_CELLS,
  WATCHTOWERS,
  cellId,
  colLabel,
  eastArmX,
  riverXs,
  rowName,
  westArmX,
} from "./layout";
import { inZone, isContested, totalForce, type CellState, type GameEvent } from "./state";

// ---------------------------------------------------------------------------
// World geometry (world units; the canvas transform does the zoom)
// ---------------------------------------------------------------------------
export const CELL = 32;
export const ML = 56; // left/right margin
export const MT = 96; // top/bottom margin (cartouche & compass live there)
export const WORLD_W = GRID_W * CELL + ML * 2;
export const WORLD_H = GRID_H * CELL + MT * 2;
export const cx = (x: number) => ML + x * CELL;
export const cy = (y: number) => MT + y * CELL;

export const INK = "#2A1F14";
export const PARCH = "#E6D8B8";
export const BURNT = "#C9B48A";
export const GOLD = "#C9A24B";
export const BLOOD = "#8E1B1B";
export const CHARCOAL = "#141210";
const WATER = "#B4C2B4";

export interface Fonts {
  cinzel: string;
  fell: string;
  mono: string;
}

export function worldToCell(wx: number, wy: number): number | null {
  const x = Math.floor((wx - ML) / CELL);
  const y = Math.floor((wy - MT) / CELL);
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return null;
  return cellId(x, y);
}

type Ctx = CanvasRenderingContext2D;
type Rng = () => number;
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

// ---------------------------------------------------------------------------
// Pen helpers — slightly wobbly strokes, like a quill
// ---------------------------------------------------------------------------
function penLine(ctx: Ctx, rng: Rng, x1: number, y1: number, x2: number, y2: number, wobble = 0.8) {
  const mx = (x1 + x2) / 2 + (rng() - 0.5) * wobble * 2;
  const my = (y1 + y2) / 2 + (rng() - 0.5) * wobble * 2;
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(mx, my, x2, y2);
}

function ink(ctx: Ctx, width = 0.9, alpha = 0.85) {
  ctx.strokeStyle = rgba(INK, alpha);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function mountain(ctx: Ctx, rng: Rng, x: number, by: number, w: number, h: number) {
  const px = x + w * (0.45 + rng() * 0.1);
  ctx.beginPath();
  ink(ctx, 1);
  ctx.moveTo(x, by);
  ctx.lineTo(px - w * 0.08, by - h * 0.85);
  ctx.lineTo(px, by - h);
  ctx.lineTo(px + w * 0.12, by - h * 0.8);
  ctx.lineTo(x + w, by);
  ctx.fillStyle = PARCH;
  ctx.fill();
  ctx.stroke();
  // engraved shading on the lee side
  ctx.beginPath();
  ink(ctx, 0.6, 0.6);
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const sx = px + (x + w - px) * t * 0.9;
    const sy = by - h + h * t;
    penLine(ctx, rng, sx - 1, sy, sx - 4 + t * 2, by - 1, 0.4);
  }
  ctx.stroke();
}

function tree(ctx: Ctx, rng: Rng, x: number, by: number, r: number) {
  ctx.beginPath();
  ink(ctx, 0.8);
  penLine(ctx, rng, x, by, x, by - r * 1.2, 0.2);
  ctx.stroke();
  ctx.beginPath();
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.85 + rng() * 0.3);
    const px = x + Math.cos(a) * rr;
    const py = by - r * 1.6 + Math.sin(a) * rr * 0.95;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = PARCH;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ink(ctx, 0.5, 0.55);
  for (let i = 0; i < 3; i++) {
    const yy = by - r * 1.6 - r * 0.3 + i * r * 0.4;
    penLine(ctx, rng, x + r * 0.15, yy, x + r * 0.75, yy + r * 0.25, 0.3);
  }
  ctx.stroke();
}

function house(ctx: Ctx, rng: Rng, x: number, by: number, s: number) {
  ctx.beginPath();
  ink(ctx, 0.8);
  ctx.rect(x - s / 2, by - s * 0.7, s, s * 0.7);
  ctx.fillStyle = PARCH;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.62, by - s * 0.68);
  ctx.lineTo(x, by - s * 1.25);
  ctx.lineTo(x + s * 0.62, by - s * 0.68);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ink(ctx, 0.5, 0.6);
  for (let i = 1; i < 4; i++) penLine(ctx, rng, x + i * s * 0.12, by - s * 1.2 + i * s * 0.12, x + s * 0.55, by - s * 0.7, 0.2);
  ctx.moveTo(x - s * 0.1, by);
  ctx.lineTo(x - s * 0.1, by - s * 0.3);
  ctx.lineTo(x + s * 0.1, by - s * 0.3);
  ctx.lineTo(x + s * 0.1, by);
  ctx.stroke();
}

function tuft(ctx: Ctx, rng: Rng, x: number, y: number, s = 3) {
  ctx.beginPath();
  ink(ctx, 0.55, 0.5);
  penLine(ctx, rng, x - s, y, x - s * 0.5, y - s * 1.2, 0.3);
  penLine(ctx, rng, x, y, x, y - s * 1.6, 0.3);
  penLine(ctx, rng, x + s, y, x + s * 0.5, y - s * 1.2, 0.3);
  ctx.stroke();
}

// --- homeland motifs -------------------------------------------------------
function pit(ctx: Ctx, rng: Rng, x: number, y: number, r: number) {
  ctx.beginPath();
  ink(ctx, 0.9);
  ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  ink(ctx, 0.55, 0.7);
  for (let i = -r; i < r; i += 2) penLine(ctx, rng, x + i, y - r, x + i + r * 0.6, y + r, 0.3);
  ctx.stroke();
  ctx.restore();
  // pit-prop timbers
  ctx.beginPath();
  ink(ctx, 0.9);
  ctx.moveTo(x - r * 0.4, y + r * 0.1);
  ctx.lineTo(x - r * 0.4, y - r * 0.75);
  ctx.lineTo(x + r * 0.4, y - r * 0.75);
  ctx.lineTo(x + r * 0.4, y + r * 0.1);
  ctx.stroke();
}

function reeds(ctx: Ctx, rng: Rng, x: number, y: number) {
  ctx.beginPath();
  ink(ctx, 0.55, 0.65);
  for (let i = 0; i < 4; i++) {
    const rx = x + (rng() - 0.5) * 8;
    penLine(ctx, rng, rx, y, rx + (rng() - 0.5) * 3, y - 5 - rng() * 5, 0.5);
  }
  for (let i = 0; i < 2; i++) {
    const wy = y + 3 + i * 2.5;
    penLine(ctx, rng, x - 7, wy, x + 7, wy, 1);
  }
  ctx.stroke();
}

function barrow(ctx: Ctx, rng: Rng, x: number, by: number, w: number) {
  ctx.beginPath();
  ink(ctx, 0.9);
  ctx.moveTo(x - w / 2, by);
  ctx.quadraticCurveTo(x, by - w * 0.75, x + w / 2, by);
  ctx.fillStyle = PARCH;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ink(ctx, 0.5, 0.6);
  for (let i = 0; i < 4; i++) {
    const t = 0.15 + i * 0.18;
    penLine(ctx, rng, x + w * (t - 0.05), by - w * 0.3 + i, x + w * t, by - 1, 0.2);
  }
  ctx.stroke();
  // standing stone + weeping drops
  ctx.beginPath();
  ink(ctx, 0.8);
  ctx.rect(x - 1.5, by - w * 0.55, 3, 6);
  ctx.stroke();
  ctx.fillStyle = rgba(INK, 0.55);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x - w * 0.25 + i * w * 0.25, by + 3 + rng() * 2, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function burntField(ctx: Ctx, rng: Rng, x: number, y: number) {
  ctx.beginPath();
  ink(ctx, 0.55, 0.55);
  for (let i = 0; i < 5; i++) penLine(ctx, rng, x + 2, y + 6 + i * 5, x + CELL - 2, y + 2 + i * 5, 0.8);
  ctx.stroke();
  if (rng() < 0.45) {
    // a small flame and its smoke
    const fx = x + 8 + rng() * 16;
    const fy = y + 22;
    ctx.beginPath();
    ink(ctx, 0.8);
    ctx.moveTo(fx - 3, fy);
    ctx.quadraticCurveTo(fx - 4, fy - 5, fx, fy - 9);
    ctx.quadraticCurveTo(fx + 4, fy - 5, fx + 3, fy);
    ctx.closePath();
    ctx.fillStyle = rgba(INK, 0.15);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ink(ctx, 0.5, 0.45);
    ctx.moveTo(fx, fy - 10);
    ctx.bezierCurveTo(fx + 5, fy - 13, fx - 4, fy - 16, fx + 2, fy - 20);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Static background: parchment, terrain, river, bridges, towers, frame, decor
// ---------------------------------------------------------------------------
export function drawBackground(canvas: HTMLCanvasElement, R: number, fonts: Fonts, seasonTitle: string, seasonSub: string) {
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(R, 0, 0, R, 0, 0);
  const rc = rough.canvas(canvas);
  const rng = mulberry32(1337);

  // the page behind the sheet
  ctx.fillStyle = CHARCOAL;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // sheet with a slightly ragged edge
  ctx.beginPath();
  const edge: [number, number][] = [];
  const step = 24;
  for (let x = 4; x <= WORLD_W - 4; x += step) edge.push([x, 4 + rng() * 4]);
  for (let y = 4; y <= WORLD_H - 4; y += step) edge.push([WORLD_W - 4 - rng() * 4, y]);
  for (let x = WORLD_W - 4; x >= 4; x -= step) edge.push([x, WORLD_H - 4 - rng() * 4]);
  for (let y = WORLD_H - 4; y >= 4; y -= step) edge.push([4 + rng() * 4, y]);
  edge.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = PARCH;
  ctx.fill();
  ctx.save();
  ctx.clip();

  // aged edges
  const g = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.35, WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.62);
  g.addColorStop(0, rgba(BURNT, 0));
  g.addColorStop(0.7, rgba(BURNT, 0.55));
  g.addColorStop(1, rgba("#8a6f45", 0.9));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // stains
  for (let i = 0; i < 18; i++) {
    const sx = rng() * WORLD_W;
    const sy = rng() * WORLD_H;
    const sr = 30 + rng() * 120;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    sg.addColorStop(0, rgba(BURNT, 0.28));
    sg.addColorStop(0.8, rgba(BURNT, 0.12));
    sg.addColorStop(1, rgba(BURNT, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }
  // fibres and specks
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rgba(INK, 0.03 + rng() * 0.08);
    ctx.fillRect(rng() * WORLD_W, rng() * WORLD_H, 0.6 + rng(), 0.6 + rng());
  }
  ctx.beginPath();
  ink(ctx, 0.4, 0.05);
  for (let i = 0; i < 400; i++) {
    const fx = rng() * WORLD_W;
    const fy = rng() * WORLD_H;
    penLine(ctx, rng, fx, fy, fx + (rng() - 0.5) * 14, fy + (rng() - 0.5) * 6, 1);
  }
  ctx.stroke();

  // --- terrain per cell ----------------------------------------------------
  for (const sc of STATIC_CELLS) {
    const r = mulberry32(hash2(sc.x, sc.y, 3));
    const x = cx(sc.x);
    const y = cy(sc.y);
    if (sc.kind === "blocked" || sc.kind === "bridge" || sc.kind === "bonus" || sc.baseOf) continue;
    switch (sc.region) {
      case "goblins":
        if (r() < 0.55) pit(ctx, r, x + 10 + r() * 12, y + 14 + r() * 6, 6 + r() * 4);
        else tuft(ctx, r, x + 16, y + 24);
        if (r() < 0.25) mountain(ctx, r, x + 2, y + 30, 16, 12);
        continue;
      case "changelings":
        reeds(ctx, r, x + 8 + r() * 6, y + 16);
        if (r() < 0.6) reeds(ctx, r, x + 20 + r() * 6, y + 26);
        if (r() < 0.3) tree(ctx, r, x + 24, y + 18, 4);
        continue;
      case "knaves":
        if (r() < 0.7) {
          house(ctx, r, x + 10, y + 16, 9);
          if (r() < 0.7) house(ctx, r, x + 22, y + 26, 8);
        } else tuft(ctx, r, x + 16, y + 22);
        continue;
      case "unburied":
        if (r() < 0.6) barrow(ctx, r, x + 16, y + 24, 18 + r() * 8);
        else tuft(ctx, r, x + 14, y + 20);
        continue;
      case "wretches":
        burntField(ctx, r, x, y);
        continue;
    }
    switch (sc.terrain) {
      case "mountain":
        mountain(ctx, r, x - 2, y + 30, 22, 18 + r() * 6);
        if (r() < 0.5) mountain(ctx, r, x + 14, y + 31, 18, 12);
        break;
      case "forest":
        tree(ctx, r, x + 9, y + 15, 5);
        tree(ctx, r, x + 22, y + 13, 5);
        tree(ctx, r, x + 15, y + 28, 5.5);
        break;
      case "village":
        house(ctx, r, x + 11, y + 18, 9);
        house(ctx, r, x + 22, y + 26, 8);
        break;
      default:
        if (r() < 0.3) tuft(ctx, r, x + 6 + r() * 20, y + 10 + r() * 18);
        if (r() < 0.12) tree(ctx, r, x + 8 + r() * 16, y + 22, 4);
    }
  }

  // Changeling mist
  {
    const f = FACTION_BY_ID.changelings;
    for (let i = 0; i < 7; i++) {
      const mx = cx(f.base.x + 1 + (rng() - 0.5) * 10);
      const my = cy(f.base.y + 1 + (rng() - 0.5) * 8);
      const mr = 40 + rng() * 50;
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      mg.addColorStop(0, "rgba(250,246,236,0.45)");
      mg.addColorStop(1, "rgba(250,246,236,0)");
      ctx.fillStyle = mg;
      ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }
  }
  // Knave's Hollow embankment (the "hollow")
  {
    ctx.beginPath();
    ink(ctx, 0.6, 0.5);
    const r2 = mulberry32(55);
    for (let y = FORK_TOP + 1; y <= FORK_BOTTOM - 1; y++) {
      const wx = cx(westArmX(y) + 1) + 3;
      const ex = cx(eastArmX(y)) - 3;
      for (let k = 0; k < 3; k++) {
        const yy = cy(y) + k * 10 + 4;
        penLine(ctx, r2, wx, yy, wx + 4, yy + 3, 0.3);
        penLine(ctx, r2, ex, yy, ex - 4, yy + 3, 0.3);
      }
    }
    ctx.stroke();
  }

  drawRiver(ctx, rng);
  drawBridges(ctx, rc);
  drawTowers(ctx, rc);
  drawBaseCamps(ctx, rc);

  // grid — pale ink
  ctx.beginPath();
  ctx.strokeStyle = rgba(INK, 0.13);
  ctx.lineWidth = 0.6;
  for (let x = 0; x <= GRID_W; x++) {
    ctx.moveTo(cx(x), MT);
    ctx.lineTo(cx(x), MT + GRID_H * CELL);
  }
  for (let y = 0; y <= GRID_H; y++) {
    ctx.moveTo(ML, cy(y));
    ctx.lineTo(ML + GRID_W * CELL, cy(y));
  }
  ctx.stroke();

  drawFrame(ctx, fonts);
  drawLabels(ctx, fonts);
  drawCartouche(ctx, rc, fonts, seasonTitle, seasonSub);
  drawCompass(ctx, fonts);
  drawScaleBar(ctx, fonts);
  ctx.restore();
}

function riverPath(ctx: Ctx, pts: [number, number][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
}

function drawRiver(ctx: Ctx, rng: Rng) {
  const center = (y: number) => {
    const xs = riverXs(y);
    return [cx(xs[0]) + CELL, cy(y) + CELL / 2] as [number, number];
  };
  const north: [number, number][] = [[center(0)[0], 6]];
  for (let y = 0; y < FORK_TOP; y++) north.push(center(y));
  const south: [number, number][] = [];
  for (let y = FORK_BOTTOM + 1; y < GRID_H; y++) south.push(center(y));
  south.push([south[south.length - 1][0], WORLD_H - 6]);
  const arm = (xf: (y: number) => number) => {
    const p: [number, number][] = [north[north.length - 1]];
    for (let y = FORK_TOP; y <= FORK_BOTTOM; y++) p.push([cx(xf(y)) + CELL / 2, cy(y) + CELL / 2]);
    p.push(south[0]);
    return p;
  };
  const west = arm(westArmX);
  const east = arm(eastArmX);

  const strokes: [[number, number][], number][] = [
    [north, CELL * 2 - 8],
    [south, CELL * 2 - 8],
    [west, CELL - 6],
    [east, CELL - 6],
  ];
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [p, w] of strokes) {
    riverPath(ctx, p);
    ctx.strokeStyle = rgba(INK, 0.9);
    ctx.lineWidth = w + 3;
    ctx.stroke();
  }
  for (const [p, w] of strokes) {
    riverPath(ctx, p);
    ctx.strokeStyle = WATER;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  // waterlines parallel to the banks
  for (const [p, w] of strokes) {
    riverPath(ctx, p);
    ctx.strokeStyle = rgba("#f3eedf", 0.35);
    ctx.lineWidth = w * 0.45;
    ctx.stroke();
  }
  // ripples
  ctx.beginPath();
  ink(ctx, 0.6, 0.35);
  for (const sc of STATIC_CELLS) {
    if (sc.kind !== "blocked") continue;
    for (let k = 0; k < 2; k++) {
      const x = cx(sc.x) + 8 + rng() * 12;
      const y = cy(sc.y) + 8 + rng() * 16;
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 2, y - 2, x + 4, y + 2, x + 6, y);
      ctx.bezierCurveTo(x + 8, y - 2, x + 10, y + 2, x + 12, y);
    }
  }
  ctx.stroke();
}

type Rough = ReturnType<typeof rough.canvas>;

function drawBridges(ctx: Ctx, rc: Rough) {
  for (const [bx, by] of BRIDGES) {
    const x = cx(bx) - 5;
    const y = cy(by) + 8;
    const w = CELL + 10;
    const h = CELL - 16;
    const seed = cellId(bx, by) + 1;
    rc.rectangle(x, y, w, h, { seed, stroke: INK, strokeWidth: 1.1, fill: PARCH, fillStyle: "solid", roughness: 0.9 });
    ctx.beginPath();
    ink(ctx, 0.6, 0.7);
    for (let px = x + 4; px < x + w - 2; px += 4) {
      ctx.moveTo(px, y + 1);
      ctx.lineTo(px, y + h - 1);
    }
    ctx.stroke();
    rc.line(x - 3, y - 2, x + w + 3, y - 2, { seed: seed + 1, stroke: INK, strokeWidth: 1.2, roughness: 0.8 });
    rc.line(x - 3, y + h + 2, x + w + 3, y + h + 2, { seed: seed + 2, stroke: INK, strokeWidth: 1.2, roughness: 0.8 });
  }
}

function drawTowers(ctx: Ctx, rc: Rough) {
  for (const [tx, ty] of WATCHTOWERS) {
    const seed = cellId(tx, ty) + 1;
    const x = cx(tx) + CELL / 2;
    const by = cy(ty) + CELL - 4;
    rc.polygon(
      [
        [x - 7, by],
        [x - 5, by - 16],
        [x + 5, by - 16],
        [x + 7, by],
      ],
      { seed, stroke: INK, strokeWidth: 1, fill: PARCH, fillStyle: "solid", roughness: 0.7 },
    );
    rc.polygon(
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
      { seed: seed + 1, stroke: INK, strokeWidth: 0.9, fill: PARCH, fillStyle: "solid", roughness: 0.5 },
    );
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

function drawBaseCamps(ctx: Ctx, rc: Rough) {
  for (const f of FACTIONS) {
    const x = cx(f.base.x);
    const y = cy(f.base.y);
    const s = CELL * 2;
    const seed = cellId(f.base.x, f.base.y) + 1;
    rc.rectangle(x + 3, y + 3, s - 6, s - 6, { seed, stroke: INK, strokeWidth: 1.3, roughness: 1.1 });
    rc.rectangle(x + 6, y + 6, s - 12, s - 12, { seed: seed + 7, stroke: INK, strokeWidth: 0.7, roughness: 1.1 });
    // palisade stakes
    ctx.beginPath();
    ink(ctx, 0.7, 0.8);
    for (let i = 6; i < s - 4; i += 5) {
      ctx.moveTo(x + i, y + 3);
      ctx.lineTo(x + i, y);
      ctx.moveTo(x + i, y + s - 3);
      ctx.lineTo(x + i, y + s);
      ctx.moveTo(x + 3, y + i);
      ctx.lineTo(x, y + i);
      ctx.moveTo(x + s - 3, y + i);
      ctx.lineTo(x + s, y + i);
    }
    ctx.stroke();
  }
}

function drawFrame(ctx: Ctx, fonts: Fonts) {
  const x0 = ML;
  const y0 = MT;
  const w = GRID_W * CELL;
  const h = GRID_H * CELL;
  ink(ctx, 1.6, 0.9);
  ctx.strokeRect(x0 - 6, y0 - 6, w + 12, h + 12);
  ink(ctx, 0.7, 0.9);
  ctx.strokeRect(x0 - 2, y0 - 2, w + 4, h + 4);
  // corner diamonds
  ctx.fillStyle = INK;
  for (const [px, py] of [
    [x0 - 6, y0 - 6],
    [x0 + w + 6, y0 - 6],
    [x0 - 6, y0 + h + 6],
    [x0 + w + 6, y0 + h + 6],
  ]) {
    ctx.beginPath();
    ctx.moveTo(px, py - 5);
    ctx.lineTo(px + 5, py);
    ctx.lineTo(px, py + 5);
    ctx.lineTo(px - 5, py);
    ctx.closePath();
    ctx.fill();
  }
  // coordinates
  ctx.fillStyle = rgba(INK, 0.75);
  ctx.font = `9px ${fonts.fell}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let x = 0; x < GRID_W; x++) {
    ctx.fillText(colLabel(x), cx(x) + CELL / 2, y0 - 14);
    ctx.fillText(colLabel(x), cx(x) + CELL / 2, y0 + h + 14);
  }
  for (let y = 0; y < GRID_H; y++) {
    ctx.fillText(rowName(y), x0 - 18, cy(y) + CELL / 2);
    ctx.fillText(rowName(y), x0 + w + 18, cy(y) + CELL / 2);
  }
}

function label(ctx: Ctx, text: string, x: number, y: number, size: number, font: string, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `italic ${size}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = rgba(PARCH, 0.8);
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = rgba(INK, 0.9);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawLabels(ctx: Ctx, fonts: Fonts) {
  const f = fonts.fell;
  label(ctx, "The Gnawing Pits", cx(5), cy(8.6), 15, f);
  label(ctx, "The Cradle Fen", cx(5), cy(22.4), 15, f);
  label(ctx, "The Weeping Barrows", cx(43), cy(8.6), 15, f);
  label(ctx, "The Burnt Fields", cx(43), cy(22.4), 15, f);
  label(ctx, "Knave's Hollow", cx(24), cy(12.5), 14, f);
  const n = riverXs(2);
  label(ctx, "River Wend", cx(n[0]) + CELL, cy(2.5), 12, f, -Math.PI / 2);
  label(ctx, "the Weir", cx(westArmX(15)) + CELL / 2, cy(15), 10, f, -Math.PI / 2);
  label(ctx, "the Mourning Reach", cx(eastArmX(15)) + CELL / 2, cy(15), 10, f, Math.PI / 2);
  label(ctx, "Ashen March", cx(13), cy(14.5), 12, f);
  label(ctx, "Crowfeeder Wood", cx(35), cy(14.5), 12, f);
}

function drawCartouche(ctx: Ctx, rc: Rough, fonts: Fonts, title: string, sub: string) {
  const x = 22;
  const y = 12;
  const w = 360;
  const h = 72;
  rc.rectangle(x, y, w, h, { seed: 9001, stroke: INK, strokeWidth: 1.4, fill: "#efe4c8", fillStyle: "solid", roughness: 0.8 });
  rc.rectangle(x + 5, y + 5, w - 10, h - 10, { seed: 9002, stroke: INK, strokeWidth: 0.6, roughness: 0.8 });
  // scroll curls
  for (const side of [-1, 1]) {
    const sx = side < 0 ? x : x + w;
    ctx.beginPath();
    ink(ctx, 1.1, 0.9);
    for (let a = 0; a < Math.PI * 3.2; a += 0.15) {
      const r = 2 + a * 1.6;
      const px = sx + side * (Math.cos(a) * r - 4);
      const py = y + h / 2 + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 22px ${fonts.cinzel}`;
  ctx.fillText(title.toUpperCase(), x + w / 2, y + 30);
  ctx.font = `italic 13px ${fonts.fell}`;
  ctx.fillStyle = rgba(INK, 0.85);
  ctx.fillText(sub, x + w / 2, y + 53);
  // flourishes
  ctx.beginPath();
  ink(ctx, 0.8, 0.8);
  ctx.moveTo(x + 60, y + 44);
  ctx.quadraticCurveTo(x + w / 2, y + 38, x + w - 60, y + 44);
  ctx.stroke();

  // slogan, opposite corner of the top margin
  ctx.textAlign = "right";
  ctx.font = `italic 15px ${fonts.fell}`;
  ctx.fillStyle = rgba(INK, 0.8);
  ctx.fillText("Every token has a price in blood.", WORLD_W - 30, 54);
}

function drawCompass(ctx: Ctx, fonts: Fonts) {
  const x = WORLD_W - 110;
  const y = WORLD_H - 46;
  const r = 34;
  ink(ctx, 0.8, 0.9);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r - 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ink(ctx, 0.4, 0.6);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    ctx.moveTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4));
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
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
  for (let i = 0; i < 4; i++) point(Math.PI / 4 + (i * Math.PI) / 2, r * 0.6, 4);
  for (let i = 0; i < 4; i++) point(-Math.PI / 2 + (i * Math.PI) / 2, r + 8, 6);
  ctx.fillStyle = INK;
  ctx.font = `600 12px ${fonts.cinzel}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", x, y - r - 14);
}

function drawScaleBar(ctx: Ctx, fonts: Fonts) {
  const x = 40;
  const y = WORLD_H - 44;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? PARCH : INK;
    ctx.fillRect(x + i * CELL, y, CELL, 5);
  }
  ink(ctx, 0.7, 1);
  ctx.strokeRect(x, y, CELL * 5, 5);
  ctx.fillStyle = INK;
  ctx.font = `italic 11px ${fonts.fell}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Leagues", x, y - 6);
  ctx.textAlign = "center";
  ctx.font = `9px ${fonts.fell}`;
  for (let i = 0; i <= 5; i++) ctx.fillText(String(i * 10), x + i * CELL, y + 16);
}

// ---------------------------------------------------------------------------
// Territory layer: wash (multiply, 50 %) + engraved hatching by garrison strength
// Composited onto the background with "multiply" (white = no change).
// ---------------------------------------------------------------------------
export function strengthOf(total: number) {
  if (total <= 0) return 0;
  return Math.min(1, Math.sqrt(total / (MAX_FORCE_PER_CELL * 0.75)));
}

export function drawTerritory(canvas: HTMLCanvasElement, R: number, cells: CellState[]) {
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(R, 0, 0, R, 0, 0);

  // 1. opaque washes
  for (const c of cells) {
    if (!c.owner) continue;
    ctx.fillStyle = FACTION_BY_ID[c.owner].color;
    ctx.fillRect(cx(c.id % GRID_W) - 0.25, cy(Math.floor(c.id / GRID_W)) - 0.25, CELL + 0.5, CELL + 0.5);
  }
  // 2. dilute to 50 % (ink on paper), white elsewhere
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // 3. hatching — spaced when weak, tight cross-hatching when strong
  ctx.globalCompositeOperation = "multiply";
  const rc = rough.canvas(canvas);
  for (const c of cells) {
    if (!c.owner) continue;
    const s = strengthOf(totalForce(c));
    if (s < 0.1) continue;
    const x = cx(c.id % GRID_W);
    const y = cy(Math.floor(c.id / GRID_W));
    const gap = 13 - s * 9.5;
    rc.rectangle(x + 2, y + 2, CELL - 4, CELL - 4, {
      seed: c.id + 1,
      stroke: "none",
      fill: rgba(INK, 0.22 + s * 0.32),
      fillStyle: s > 0.55 ? "cross-hatch" : "hachure",
      hachureGap: gap,
      hachureAngle: -41,
      fillWeight: 0.45 + s * 0.4,
      roughness: 1.1,
    });
  }

  // 4. borders between Banners, inked
  ctx.beginPath();
  ctx.strokeStyle = rgba(INK, 0.7);
  ctx.lineWidth = 1.3;
  ctx.lineCap = "round";
  for (const c of cells) {
    const x = c.id % GRID_W;
    const y = Math.floor(c.id / GRID_W);
    if (x < GRID_W - 1) {
      const o = cells[c.id + 1].owner;
      if (o !== c.owner && (o || c.owner)) {
        ctx.moveTo(cx(x + 1), cy(y));
        ctx.lineTo(cx(x + 1), cy(y + 1));
      }
    }
    if (y < GRID_H - 1) {
      const o = cells[c.id + GRID_W].owner;
      if (o !== c.owner && (o || c.owner)) {
        ctx.moveTo(cx(x), cy(y + 1));
        ctx.lineTo(cx(x + 1), cy(y + 1));
      }
    }
  }
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

// ---------------------------------------------------------------------------
// Per-frame overlay: filters, my cells, contested pulse, events, wet ink, crests
// ---------------------------------------------------------------------------
export type MapFilter = "all" | "mine" | "contested" | "events";

export interface OverlayInput {
  cells: CellState[];
  myFaction: FactionId | null;
  selectedId: number | null;
  hoverId: number | null;
  filter: MapFilter;
  events: GameEvent[];
  now: number;
  fonts: Fonts;
  crests: Partial<Record<FactionId, HTMLImageElement>>;
  /** screen px per world unit — used to keep strokes legible and skip tiny text */
  scale: number;
}

const compact = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function drawOverlay(ctx: Ctx, o: OverlayInput, t: number) {
  const { cells, now, fonts } = o;
  const px = 1 / o.scale; // one screen pixel in world units
  const activeEvents = o.events.filter((e) => e.zone && e.endsAt > now);

  // filter fog
  if (o.filter !== "all") {
    ctx.fillStyle = "rgba(20,18,16,0.5)";
    for (const c of cells) {
      const x = c.id % GRID_W;
      const y = Math.floor(c.id / GRID_W);
      const keep =
        o.filter === "mine"
          ? c.mine > 0
          : o.filter === "contested"
            ? isContested(c)
            : activeEvents.some((e) => inZone(x, y, e.zone));
      if (!keep) ctx.fillRect(cx(x), cy(y), CELL, CELL);
    }
  }

  // crests on base camps
  for (const f of FACTIONS) {
    const img = o.crests[f.id];
    if (!img || !img.complete || !img.naturalWidth) continue;
    const h = CELL * 1.7;
    const w = (img.naturalWidth / img.naturalHeight) * h;
    ctx.drawImage(img, cx(f.base.x) + CELL - w / 2, cy(f.base.y) + CELL - h / 2, w, h);
  }

  // contested: blood-red dotted border, gently pulsing
  const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin((t / 1000) * Math.PI * 1.3));
  ctx.save();
  ctx.setLineDash([2.2, 2.6]);
  ctx.lineWidth = Math.max(1.6, 1.4 * px);
  ctx.strokeStyle = rgba(BLOOD, pulse);
  ctx.beginPath();
  for (const c of cells) if (isContested(c)) ctx.rect(cx(c.id % GRID_W) + 2.5, cy(Math.floor(c.id / GRID_W)) + 2.5, CELL - 5, CELL - 5);
  ctx.stroke();
  ctx.restore();

  // my cells: gold outline
  ctx.beginPath();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(1.8, 1.5 * px);
  for (const c of cells) if (c.mine > 0) ctx.rect(cx(c.id % GRID_W) + 1, cy(Math.floor(c.id / GRID_W)) + 1, CELL - 2, CELL - 2);
  ctx.stroke();

  // events
  for (const e of activeEvents) {
    const z = e.zone!;
    const live = e.startsAt <= now;
    const color = e.type === "tithe" ? GOLD : BLOOD;
    const x = cx(z.x);
    const y = cy(z.y);
    const w = z.w * CELL;
    const h = z.h * CELL;
    if (e.type === "tithe" && live) {
      ctx.fillStyle = rgba(GOLD, 0.1 + 0.06 * pulse);
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

  // wet ink: my numbers, glossy while fresh, drying over the cooldown
  const cellPx = CELL * o.scale;
  if (cellPx >= 18) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const c of cells) {
      if (c.mine <= 0) continue;
      const wet = c.wetUntil && c.wetUntil > now ? (c.wetUntil - now) / (COOLDOWN_MINUTES * 60_000) : 0;
      if (wet <= 0 && cellPx < 34) continue;
      const x = cx(c.id % GRID_W) + CELL / 2;
      const y = cy(Math.floor(c.id / GRID_W)) + CELL / 2;
      const txt = compact(c.mine);
      ctx.font = `${wet > 0 ? 700 : 400} 12px ${fonts.fell}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(PARCH, 0.85);
      ctx.strokeText(txt, x, y);
      if (wet > 0) {
        ctx.shadowColor = `rgba(20,30,70,${0.6 * wet})`;
        ctx.shadowBlur = 4 * wet;
        // fresh iron-gall ink is blue-black, it browns as it dries
        const r = Math.round(18 + (42 - 18) * (1 - wet));
        const g = Math.round(22 + (31 - 22) * (1 - wet));
        const b = Math.round(58 + (20 - 58) * (1 - wet));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillText(txt, x, y);
        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";
        ctx.fillStyle = `rgba(255,255,255,${0.55 * wet})`;
        ctx.fillText(txt, x - 0.5, y - 0.7);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.globalAlpha = 0.5;
        ctx.fillText(txt, x, y);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = rgba(INK, 0.85);
        ctx.fillText(txt, x, y);
      }
    }
  }

  // hover & selection
  if (o.hoverId !== null && o.hoverId !== o.selectedId) {
    ctx.strokeStyle = rgba(INK, 0.6);
    ctx.lineWidth = Math.max(1, px);
    ctx.strokeRect(cx(o.hoverId % GRID_W) + 0.5, cy(Math.floor(o.hoverId / GRID_W)) + 0.5, CELL - 1, CELL - 1);
  }
  if (o.selectedId !== null) {
    const x = cx(o.selectedId % GRID_W);
    const y = cy(Math.floor(o.selectedId / GRID_W));
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2.5, 2 * px);
    ctx.strokeRect(x - 1, y - 1, CELL + 2, CELL + 2);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1, px);
    ctx.strokeRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3);
    // corner ticks
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
