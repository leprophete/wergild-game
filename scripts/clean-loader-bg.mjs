// Removes the raven painted in the sky of the loading-screen illustration (the animated
// raven takes its place): masks what is darker than the sky in that area, fills it by
// diffusion from its border (clouds continue smoothly), then puts back the paper's grain
// borrowed from a clean patch of the same sky.
// Usage: node scripts/clean-loader-bg.mjs <input> <output.webp>
import sharp from "sharp";

const [, , input, output] = process.argv;
const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = 3;
const img = Float32Array.from(data);
const lum = (i) => 0.299 * img[i * 3] + 0.587 * img[i * 3 + 1] + 0.114 * img[i * 3 + 2];

// the raven and its brush trails, in the sky on the right (measured on the 1672 × 941 image)
const box = { x0: 1395, y0: 200, x1: 1648, y1: 385 };
const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
let mask = new Uint8Array(bw * bh);
for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (lum((y + box.y0) * W + x + box.x0) < 128) mask[y * bw + x] = 1;
// grow it a little so no dark fringe stays
const grow = (m, r) => {
  const o = new Uint8Array(m.length);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    if (!m[y * bw + x]) continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < bw && ny < bh && dx * dx + dy * dy <= r * r) o[ny * bw + nx] = 1;
    }
  }
  return o;
};
// the two brush trails behind it are lighter than the bird: take their whole strips
for (const [x0, y0, x1, y1] of [
  [1415, 258, 1525, 300],
  [1400, 330, 1510, 375],
]) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (lum(y * W + x) < 170) mask[(y - box.y0) * bw + (x - box.x0)] = 1;
}
mask = grow(mask, 6);

// 1. diffusion fill (coarse to fine is not needed at this size: many Jacobi passes)
const idx = [];
for (let k = 0; k < mask.length; k++) if (mask[k]) idx.push(k);
for (const k of idx) { const i = ((k / bw | 0) + box.y0) * W + (k % bw) + box.x0; for (let c = 0; c < C; c++) img[i * 3 + c] = 200; }
for (let it = 0; it < 2500; it++) {
  for (const k of idx) {
    const x = (k % bw) + box.x0, y = (k / bw | 0) + box.y0, i = y * W + x;
    for (let c = 0; c < C; c++) {
      img[i * 3 + c] = (img[(i - 1) * 3 + c] + img[(i + 1) * 3 + c] + img[(i - W) * 3 + c] + img[(i + W) * 3 + c]) / 4;
    }
  }
}

// 2. the paper's grain: the high frequencies of a clean patch of sky just above
const DY = -175;
const blurAt = (x, y, c) => {
  let s = 0, n = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { s += data[((y + dy) * W + x + dx) * 3 + c]; n++; }
  return s / n;
};
for (const k of idx) {
  const x = (k % bw) + box.x0, y = (k / bw | 0) + box.y0, i = y * W + x, sy = y + DY;
  for (let c = 0; c < C; c++) img[i * 3 + c] += 0.6 * (data[(sy * W + x) * 3 + c] - blurAt(x, sy, c));
}

const out = Buffer.from(Uint8ClampedArray.from(img));
const r = await sharp(out, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 86 }).toFile(output);
console.log(`cleaned ${idx.length} px, ${W} × ${H}, ${Math.round(r.size / 1024)} kB`);
