/**
 * Illuminated initials (lettrines), drawn in SVG in the manner of manuscript initials:
 * a burnished-gold capital on a night-blue field strewn with gold scrolls, leaves and dots,
 * a red band patterned with gold on its right, and a double gilded frame.
 *
 * The gradients and filters live once in the page (IlluminationDefs, in the root layout), so
 * every initial shares them and none depends on another one being visible.
 * All path data is computed once and rounded, so the server and the browser write the very
 * same markup (no hydration mismatch).
 */

const r2 = (v: number) => Math.round(v * 100) / 100;

/** A gold scroll: a spiral that winds inward, as in acanthus rinceaux. */
function spiral(cx: number, cy: number, r: number, start: number, turns: number, dir: 1 | -1): string {
  const steps = 28;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = start + dir * t * turns * Math.PI * 2;
    const rr = r * (1 - 0.82 * t);
    d += `${i ? "L" : "M"}${r2(cx + Math.cos(a) * rr)} ${r2(cy + Math.sin(a) * rr)}`;
  }
  return d;
}

/** A small almond leaf at (x, y), pointing at angle a (radians). */
function leaf(x: number, y: number, a: number, len: number): string {
  const w = len * 0.38;
  const tx = x + Math.cos(a) * len, ty = y + Math.sin(a) * len;
  const nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
  const mx = (x + tx) / 2, my = (y + ty) / 2;
  return `M${r2(x)} ${r2(y)} Q${r2(mx + nx)} ${r2(my + ny)} ${r2(tx)} ${r2(ty)} Q${r2(mx - nx)} ${r2(my - ny)} ${r2(x)} ${r2(y)}Z`;
}

// the blue field spans 7..79 × 7..93; the red band 81..93
const SCROLLS = [
  spiral(17, 17, 9, 0.2, 1.35, 1),
  spiral(69, 18, 8, 2.6, 1.3, -1),
  spiral(16, 82, 8.5, -0.6, 1.3, -1),
  spiral(69, 83, 9, 3.6, 1.35, 1),
  spiral(43, 12, 5, 1.2, 1.1, 1),
  spiral(43, 88, 5, -1.9, 1.1, -1),
  // smaller curls along the sides
  spiral(11.5, 34, 4.2, 0.4, 1.2, 1),
  spiral(11.5, 66, 4.2, -0.4, 1.2, -1),
  spiral(74.5, 34, 4.2, 2.7, 1.2, -1),
  spiral(74.5, 66, 4.2, 3.5, 1.2, 1),
].join(" ");
const STEMS = "M17 17 C 26 30, 12 42, 14 50 C 16 60, 26 68, 16 82 M69 18 C 60 30, 74 42, 72 50 C 70 60, 60 70, 69 83 M17 17 C 28 10, 36 14, 43 12 M69 18 C 58 10, 50 14, 43 12 M16 82 C 28 90, 36 86, 43 88 M69 83 C 58 90, 50 86, 43 88";
const LEAVES = [
  leaf(20, 29, 0.6, 9), leaf(13, 42, 2.3, 7.5), leaf(19, 61, 0.9, 8.5), leaf(13, 72, 2.6, 7.5),
  leaf(66, 29, 2.5, 9), leaf(73, 42, 0.8, 7.5), leaf(67, 61, 2.2, 8.5), leaf(73, 72, 0.5, 7.5),
  leaf(29, 12, -0.4, 7), leaf(57, 12, 3.5, 7), leaf(29, 88, 0.4, 7), leaf(57, 88, 2.7, 7),
  leaf(17, 17, -2.3, 6), leaf(69, 18, -0.8, 6), leaf(16, 82, 2.3, 6), leaf(69, 83, 0.8, 6),
].join(" ");
const DOTS: [number, number][] = [
  [27, 22], [59, 22], [26, 78], [60, 78], [10, 50], [76, 50], [43, 21], [43, 79], [22, 50], [64, 50],
  [9.5, 10], [76.5, 10], [9.5, 90], [76.5, 90], [35, 9.5], [51, 9.5], [35, 90.5], [51, 90.5], [24, 36], [62, 36], [24, 64], [62, 64],
];
const BAND_MOTIFS = Array.from({ length: 8 }, (_, i) => 12 + i * 10.6);

/** Shared gradients and filter: render once per page (root layout). */
export function IlluminationDefs() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        <linearGradient id="ini-gold" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#fff1b8" />
          <stop offset="0.28" stopColor="#e8c468" />
          <stop offset="0.55" stopColor="#c9a24b" />
          <stop offset="0.78" stopColor="#8a6420" />
          <stop offset="1" stopColor="#d9b25a" />
        </linearGradient>
        <linearGradient id="ini-goldline" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3d98a" />
          <stop offset="0.5" stopColor="#c9a24b" />
          <stop offset="1" stopColor="#9a7428" />
        </linearGradient>
        <radialGradient id="ini-blue" cx="42%" cy="40%" r="75%">
          <stop offset="0" stopColor="#2c3f8c" />
          <stop offset="0.6" stopColor="#1a2763" />
          <stop offset="1" stopColor="#0c133a" />
        </radialGradient>
        <linearGradient id="ini-red" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5e0f0f" />
          <stop offset="0.5" stopColor="#9c2420" />
          <stop offset="1" stopColor="#5e0f0f" />
        </linearGradient>
        <filter id="ini-letter" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0.6" dy="1.2" stdDeviation="0.9" floodColor="#05081c" floodOpacity="0.85" />
        </filter>
      </defs>
    </svg>
  );
}

export function IlluminatedInitial({ letter, className = "" }: { letter: string; className?: string }) {
  const L = letter.toUpperCase();
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      {/* the double gilded frame */}
      <rect x="0.8" y="0.8" width="98.4" height="98.4" rx="2" fill="url(#ini-gold)" stroke="#3a2208" strokeWidth="1" />
      <rect x="4.6" y="4.6" width="90.8" height="90.8" fill="#2a1a08" />
      {/* the blue field */}
      <rect x="6.2" y="6.2" width="73.6" height="87.6" fill="url(#ini-blue)" />
      {/* the red band, patterned with gold */}
      <rect x="81.2" y="6.2" width="12.6" height="87.6" fill="url(#ini-red)" />
      <path d="M81.2 6.2V93.8" stroke="url(#ini-goldline)" strokeWidth="1.4" />
      {BAND_MOTIFS.map((y) => (
        <g key={y} fill="url(#ini-goldline)">
          <path d={`M87.5 ${r2(y - 3.4)} L90.3 ${r2(y)} L87.5 ${r2(y + 3.4)} L84.7 ${r2(y)}Z`} />
          <circle cx="87.5" cy={r2(y + 5.3)} r="0.9" />
        </g>
      ))}
      {/* gold rinceaux: stems, spirals, leaves, dots */}
      <g fill="none" stroke="url(#ini-goldline)" strokeLinecap="round" strokeLinejoin="round" opacity="0.92">
        <path d={STEMS} strokeWidth="2" />
        <path d={SCROLLS} strokeWidth="2.2" />
      </g>
      <path d={LEAVES} fill="url(#ini-goldline)" stroke="#5a3d0e" strokeWidth="0.4" />
      {/* a fine gold rule around the blue field */}
      <rect x="7.4" y="7.4" width="71.2" height="85.2" fill="none" stroke="url(#ini-goldline)" strokeWidth="0.8" />
      {DOTS.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.35" fill="#f3d98a" />
      ))}
      {/* the capital, in burnished gold */}
      <text
        x="43"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="70"
        fontWeight="700"
        fontStyle="normal"
        fill="url(#ini-gold)"
        stroke="#2a1806"
        strokeWidth="1.6"
        paintOrder="stroke"
        filter="url(#ini-letter)"
        style={{ fontFamily: "var(--nf-cinzel), serif" }}
      >
        {L}
      </text>
      {/* a thin inner light along the frame */}
      <rect x="2.6" y="2.6" width="94.8" height="94.8" rx="1.4" fill="none" stroke="#fff1b8" strokeOpacity="0.45" strokeWidth="0.6" />
    </svg>
  );
}
