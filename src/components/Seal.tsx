/** A wax seal in a Banner's colour, its crest pressed into it. Pure SVG, no image of the seal itself. */

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return `rgb(${ch(n >> 16)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

/** Irregular blob of melted wax: a circle with soft, uneven lobes (deterministic). */
function blob(r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 72; i++) {
    const t = (i / 72) * Math.PI * 2;
    const k = r * (1 + 0.055 * Math.sin(11 * t) + 0.035 * Math.sin(5 * t + 1.3) + 0.02 * Math.sin(17 * t + 0.4));
    pts.push(`${(50 + k * Math.cos(t)).toFixed(2)},${(50 + k * Math.sin(t)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}
const BLOB = blob(43);

export function WaxSeal({
  color,
  crest,
  size = 96,
  className = "",
  title,
}: {
  color: string;
  crest?: string | null;
  size?: number;
  className?: string;
  title?: string;
}) {
  const id = `seal-${color.slice(1)}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <radialGradient id={`${id}-g`} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor={shade(color, 0.28)} />
          <stop offset="0.55" stopColor={color} />
          <stop offset="1" stopColor={shade(color, -0.55)} />
        </radialGradient>
        <clipPath id={`${id}-c`}>
          <circle cx="50" cy="50" r="27" />
        </clipPath>
      </defs>
      <path d={BLOB} fill={`url(#${id}-g)`} style={{ filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.55))" }} />
      {/* pressed rim */}
      <circle cx="50" cy="50" r="31" fill="none" stroke={shade(color, -0.45)} strokeWidth="3.2" opacity="0.8" />
      <circle cx="50" cy="50" r="33" fill="none" stroke={shade(color, 0.35)} strokeWidth="1" opacity="0.6" />
      <circle cx="50" cy="50" r="27" fill={shade(color, -0.2)} />
      {crest && (
        <image
          href={crest}
          x="27"
          y="25"
          width="46"
          height="50"
          clipPath={`url(#${id}-c)`}
          preserveAspectRatio="xMidYMid meet"
          style={{ mixBlendMode: "luminosity", opacity: 0.55, filter: "grayscale(1) contrast(1.4)" }}
        />
      )}
      {/* gloss */}
      <ellipse cx="38" cy="30" rx="13" ry="6" fill="#fff" opacity="0.16" transform="rotate(-25 38 30)" />
    </svg>
  );
}

/** Colour of the wax when no Banner won (nobody scored). */
export const PLAIN_WAX = "#6b5a45";
