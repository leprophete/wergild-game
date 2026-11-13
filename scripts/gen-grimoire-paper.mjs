// An old grimoire leaf: mottled parchment with cream patches, rust-orange water stains and
// their darker tide lines, ink blots, red drops and burnt edges. Rendered from SVG filters
// (fractal noise), no external asset.
// Output: public/ornaments/web/grimoire_paper.webp
// Usage: node scripts/gen-grimoire-paper.mjs
import sharp from "sharp";

const W = 1000, H = 1500;

// deterministic pseudo-random, so the leaf is the same at every run
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** A splash with droplets around it (ink or red). */
function splash(cx, cy, r, colour, opacity, drops) {
  let s = `<g filter="url(#blotEdge)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${colour}" fill-opacity="${opacity}"/></g>`;
  for (let i = 0; i < drops; i++) {
    const a = rnd() * Math.PI * 2, d = r * (1.3 + rnd() * 2.6), rr = Math.max(0.8, r * (0.05 + rnd() * 0.16));
    s += `<circle cx="${(cx + Math.cos(a) * d).toFixed(1)}" cy="${(cy + Math.sin(a) * d).toFixed(1)}" r="${rr.toFixed(1)}" fill="${colour}" fill-opacity="${opacity}"/>`;
  }
  return s;
}
const ink = (x, y, r) => splash(x, y, r, "#1c120a", 0.85, 14);
const red = (x, y, r) => splash(x, y, r, "#7a2e14", 0.55, 9);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <!-- cream patches where the leaf kept its colour -->
    <filter id="cream" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.0045" numOctaves="4" seed="23"/>
      <feColorMatrix values="0 0 0 0 0.93  0 0 0 0 0.85  0 0 0 0 0.66  0 0 0 3.2 -1.55"/>
    </filter>
    <!-- broad dark-brown clouds -->
    <filter id="clouds" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.0055" numOctaves="5" seed="3"/>
      <feColorMatrix values="0 0 0 0 0.33  0 0 0 0 0.19  0 0 0 0 0.07  0 0 0 -2.6 1.55"/>
    </filter>
    <!-- rust-orange water stains with ragged edges (a steep threshold of the noise) -->
    <filter id="rustStains" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.0085" numOctaves="5" seed="41"/>
      <feColorMatrix values="0 0 0 0 0.62  0 0 0 0 0.31  0 0 0 0 0.09  0 0 0 7 -3.9"/>
      <feGaussianBlur stdDeviation="0.8"/>
    </filter>
    <!-- the darker tide line along each stain's edge -->
    <filter id="tide" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.0085" numOctaves="5" seed="41"/>
      <feColorMatrix values="0 0 0 0 0.4  0 0 0 0 0.18  0 0 0 0 0.05  0 0 0 26 -14.2"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 0.9 0.9 0"/></feComponentTransfer>
      <feGaussianBlur stdDeviation="0.9"/>
    </filter>
    <!-- finer mottling -->
    <filter id="mottle" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="4" seed="11"/>
      <feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.25  0 0 0 0 0.09  0 0 0 -3 1.55"/>
    </filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="5"/>
      <feColorMatrix values="0 0 0 0 0.22  0 0 0 0 0.13  0 0 0 0 0.04  0 0 0 0.4 0"/>
    </filter>
    <filter id="blotEdge" x="-60%" y="-60%" width="220%" height="220%">
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="17" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <!-- burnt edges: an irregular, blurred limit -->
    <filter id="burn" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="5" seed="31" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="90" xChannelSelector="R" yChannelSelector="G"/>
      <feGaussianBlur stdDeviation="12"/>
    </filter>
    <mask id="edgeMask">
      <rect width="${W}" height="${H}" fill="white"/>
      <rect x="34" y="34" width="${W - 68}" height="${H - 68}" rx="40" fill="black" filter="url(#burn)"/>
    </mask>
    <radialGradient id="vig" cx="50%" cy="46%" r="70%">
      <stop offset="0.55" stop-color="#2a170a" stop-opacity="0"/>
      <stop offset="1" stop-color="#2a170a" stop-opacity="0.55"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#c69d63"/>
  <rect width="${W}" height="${H}" filter="url(#cream)"/>
  <rect width="${W}" height="${H}" filter="url(#clouds)" opacity="0.85"/>
  <rect width="${W}" height="${H}" filter="url(#rustStains)" opacity="0.55"/>
  <rect width="${W}" height="${H}" filter="url(#tide)" opacity="0.55"/>
  <rect width="${W}" height="${H}" filter="url(#mottle)" opacity="0.6"/>
  ${red(120, 650, 9)}${red(140, 1010, 7)}${red(960, 230, 5)}
  ${ink(870, 1430, 11)}${ink(90, 420, 6)}${ink(480, 1440, 8)}
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  <rect width="${W}" height="${H}" fill="#24130a" mask="url(#edgeMask)" opacity="0.95"/>
</svg>`;

const info = await sharp(Buffer.from(svg)).webp({ quality: 84 }).toFile("public/ornaments/web/grimoire_paper.webp");
console.log(`grimoire_paper ${info.width} × ${info.height}, ${Math.round(info.size / 1024)} kB`);
