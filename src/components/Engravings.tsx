/**
 * Small engraved illustrations in sepia ink (#2A1F14), for the onboarding scrolls and the
 * rules: what is game is drawn with the quill (SPEC, art direction). Pure SVG.
 */
const INK = "#2A1F14";
const line = { fill: "none", stroke: INK, strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Pawn({ x, y, h = 30 }: { x: number; y: number; h?: number }) {
  const r = h * 0.17;
  const hy = y - h + r;
  return (
    <g {...line}>
      <circle cx={x} cy={hy} r={r} />
      <path d={`M${x - h * 0.2} ${hy + r * 1.35} H${x + h * 0.2}`} />
      <path
        d={`M${x - h * 0.12} ${hy + r * 1.35} Q${x - h * 0.13} ${y - h * 0.22} ${x - h * 0.3} ${y - h * 0.07} V${y} H${x + h * 0.3} V${y - h * 0.07} Q${x + h * 0.13} ${y - h * 0.22} ${x + h * 0.12} ${hy + r * 1.35}`}
      />
      {[0, 1, 2].map((k) => (
        <path key={k} strokeWidth={0.8} d={`M${x + h * 0.06} ${y - h * (0.12 + k * 0.13)} l${h * 0.11} ${-h * 0.06}`} />
      ))}
    </g>
  );
}

function Swords({ x, y, s = 34 }: { x: number; y: number; s?: number }) {
  return (
    <g {...line} transform={`translate(${x} ${y})`}>
      {[45, -45].map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <path d={`M0 ${-s * 0.6} L${s * 0.06} ${-s * 0.48} V${s * 0.2} M0 ${-s * 0.6} L${-s * 0.06} ${-s * 0.48} V${s * 0.2}`} />
          <path strokeWidth={0.8} d={`M0 ${-s * 0.44} V${s * 0.14}`} />
          <path d={`M${-s * 0.22} ${s * 0.21} H${s * 0.22} M0 ${s * 0.22} V${s * 0.42}`} />
          <circle cx={0} cy={s * 0.47} r={s * 0.05} />
        </g>
      ))}
    </g>
  );
}

/** A stack of coins, engraved. */
function Coins({ x, y }: { x: number; y: number }) {
  return (
    <g {...line}>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <ellipse cx={x} cy={y - i * 6} rx={14} ry={4.5} fill="#E6D8B8" />
          <path strokeWidth={0.7} d={`M${x - 14} ${y - i * 6} v3 M${x + 14} ${y - i * 6} v3`} />
        </g>
      ))}
      <ellipse cx={x + 22} cy={y + 2} rx={9} ry={3} fill="#E6D8B8" />
      <text x={x} y={y - 16.5} textAnchor="middle" fontSize="6" fill={INK} stroke="none" fontFamily="var(--nf-cinzel), serif">
        W
      </text>
    </g>
  );
}

/** Scroll 1: tokens become soldiers. */
export function RaiseArmy({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 70" className={className} aria-hidden>
      <Coins x={30} y={58} />
      <path {...line} strokeWidth={1} d="M62 42 h20 m-6 -5 l6 5 l-6 5" />
      <Pawn x={100} y={62} h={30} />
      <Pawn x={120} y={60} h={34} />
      <Pawn x={140} y={62} h={30} />
    </svg>
  );
}

/** Scroll 3: a cell taken, swords on the front line. */
export function Conquer({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 70" className={className} aria-hidden>
      <g {...line} strokeWidth={0.8} strokeDasharray="3 3">
        <path d="M8 60 C 30 52, 40 20, 70 14 S 120 10, 150 22" />
      </g>
      <g {...line} strokeWidth={0.6} opacity={0.6}>
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M${20 + i * 14} 64 l6 -8`} />
        ))}
      </g>
      <path d="M40 46 L40 22 L56 26 L46 30 L54 35 L40 37" fill="#7FA83A" stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
      <Pawn x={34} y={64} h={20} />
      <Pawn x={48} y={64} h={20} />
      <Swords x={104} y={40} s={34} />
      <Pawn x={132} y={64} h={20} />
    </svg>
  );
}

export { Pawn, Swords };

/** Single marks for the rules page. */
export function Mark({ kind, className = "" }: { kind: "pawn" | "swords" | "coins" | "tower" | "hourglass"; className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} aria-hidden>
      {kind === "pawn" && (
        <>
          <Pawn x={20} y={52} h={32} />
          <Pawn x={40} y={52} h={38} />
        </>
      )}
      {kind === "swords" && <Swords x={30} y={30} s={46} />}
      {kind === "coins" && <Coins x={26} y={50} />}
      {kind === "tower" && (
        <g {...line}>
          <path d="M20 54 L23 22 H37 L40 54 Z" fill="#E6D8B8" />
          <path d="M21 22 V15 H25 V18 H28 V15 H32 V18 H35 V15 H39 V22" fill="#E6D8B8" />
          <path d="M30 15 V5 M30 5 L40 8 L30 11" />
          <rect x={28} y={30} width={4} height={6} />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} strokeWidth={0.7} d={`M${32 + i * 1.8} 24 l1 28`} />
          ))}
        </g>
      )}
      {kind === "hourglass" && (
        <g {...line}>
          <path d="M16 6 H44 M16 54 H44" strokeWidth={2} />
          <path d="M19 6 C19 22, 30 24, 30 30 C30 36, 19 38, 19 54 M41 6 C41 22, 30 24, 30 30 C30 36, 41 38, 41 54" />
          <path strokeWidth={0.8} d="M24 50 Q30 40 36 50 M27 16 H33" />
        </g>
      )}
    </svg>
  );
}
