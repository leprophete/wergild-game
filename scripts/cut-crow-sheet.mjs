// Cuts the crow sheet (4 drawings on white) into transparent WebP sprites:
// crow_wings_up, crow_wings_down, crow_perched, crow_branch (public/ornaments/web).
// The white background is removed by flood fill from the crop's borders (so light areas
// inside a drawing stay), with a soft edge and the white fringe un-mixed.
// Usage: node scripts/cut-crow-sheet.mjs <sheet.webp|png>
import sharp from "sharp";

const src = process.argv[2];
if (!src) throw new Error("usage: node scripts/cut-crow-sheet.mjs <sheet>");
const { data, info } = await sharp(src).flatten({ background: "#ffffff" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const ink = (i) => 255 - Math.min(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);

// 1. find the drawings: connected components on a coarse grid
const G = 8, gw = Math.ceil(W / G), gh = Math.ceil(H / G);
const cell = new Uint8Array(gw * gh);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink(y * W + x) > 40) cell[Math.floor(y / G) * gw + Math.floor(x / G)] = 1;
const label = new Int32Array(gw * gh).fill(-1);
const boxes = [];
for (let s = 0; s < gw * gh; s++) {
  if (!cell[s] || label[s] >= 0) continue;
  const id = boxes.length, stack = [s];
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
  label[s] = id;
  while (stack.length) {
    const c = stack.pop(), cx = c % gw, cy = (c / gw) | 0;
    n++; x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const k = ny * gw + nx;
      if (cell[k] && label[k] < 0) { label[k] = id; stack.push(k); }
    }
  }
  boxes.push({ x0: x0 * G, y0: y0 * G, x1: Math.min(W, (x1 + 1) * G), y1: Math.min(H, (y1 + 1) * G), n });
}
const big = boxes.sort((a, b) => b.n - a.n).slice(0, 4);
// name them by position: top-left = wings up, top-right = wings down (gliding), bottom-left = perched, bottom-right = branch
const name = (b) => {
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  return cy < H / 2 ? (cx < W / 2 ? "crow_wings_up" : "crow_wings_down") : cx < W / 2 ? "crow_perched" : "crow_branch";
};

// 2. cut each one out
for (const b of big) {
  const pad = 6;
  const x0 = Math.max(0, b.x0 - pad), y0 = Math.max(0, b.y0 - pad), x1 = Math.min(W, b.x1 + pad), y1 = Math.min(H, b.y1 + pad);
  const w = x1 - x0, h = y1 - y0;
  const bg = new Uint8Array(w * h);
  const stack = [];
  const pushIf = (x, y) => {
    const k = y * w + x;
    if (!bg[k] && ink((y + y0) * W + (x + x0)) < 34) { bg[k] = 1; stack.push(k); }
  };
  for (let x = 0; x < w; x++) { pushIf(x, 0); pushIf(x, h - 1); }
  for (let y = 0; y < h; y++) { pushIf(0, y); pushIf(w - 1, y); }
  const fill = () => {
    while (stack.length) {
      const k = stack.pop(), x = k % w, y = (k / w) | 0;
      if (x > 0) pushIf(x - 1, y); if (x < w - 1) pushIf(x + 1, y);
      if (y > 0) pushIf(x, y - 1); if (y < h - 1) pushIf(x, y + 1);
    }
  };
  fill();
  // white enclosed by the drawing (between the legs, between stems): a pure-white pocket of
  // some size is background too; small light highlights inside the drawing stay
  const seen = new Uint8Array(w * h);
  for (let k0 = 0; k0 < w * h; k0++) {
    if (bg[k0] || seen[k0] || ink((((k0 / w) | 0) + y0) * W + ((k0 % w) + x0)) >= 22) continue;
    const region = [k0], q = [k0];
    seen[k0] = 1;
    while (q.length) {
      const k = q.pop(), x = k % w, y = (k / w) | 0;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nk = ny * w + nx;
        if (seen[nk] || bg[nk] || ink((ny + y0) * W + (nx + x0)) >= 22) continue;
        seen[nk] = 1; q.push(nk); region.push(nk);
      }
    }
    if (region.length >= 40) for (const k of region) { stack.push(k); bg[k] = 1; }
  }
  fill(); // grow each pocket over its near-white rim
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x, i = (y + y0) * W + (x + x0);
    // soft edge: pixels of the background get 0; pixels next to it fade with their ink
    let a = 255;
    if (bg[k]) a = 0;
    else {
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && bg[ny * w + nx]) { edge = true; break; }
      }
      if (edge) a = Math.max(0, Math.min(255, Math.round(((ink(i) - 20) / 80) * 255)));
    }
    const af = a / 255;
    for (let c = 0; c < 3; c++) {
      const v = data[i * 3 + c];
      // un-mix the white the edge pixel was blended with
      out[k * 4 + c] = af > 0 ? Math.max(0, Math.min(255, Math.round((v - (1 - af) * 255) / af))) : 0;
    }
    out[k * 4 + 3] = a;
  }
  const file = `public/ornaments/web/${name(b)}.webp`;
  const r = await sharp(out, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 88, alphaQuality: 95 }).toFile(file);
  console.log(name(b), `${w}×${h}`, `${Math.round(r.size / 1024)} kB`, `from (${x0},${y0})`);
}
