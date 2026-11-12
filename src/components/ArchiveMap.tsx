import { GRID_H, GRID_W } from "@config/game";
import { FACTION_BY_ID, type FactionId } from "@/lib/factions";

/** The map as it stood at the knell: the illustration with each held cell washed in its Banner's colour. */
export function ArchiveMap({ cells, className = "" }: { cells: [number, number, FactionId][]; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-sm border border-gold/30 ${className}`} style={{ aspectRatio: `${GRID_W} / ${GRID_H}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/map/world@1x.webp" alt="" className="absolute inset-0 h-full w-full object-cover sepia-[0.25]" />
      <svg viewBox={`0 0 ${GRID_W} ${GRID_H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full mix-blend-multiply" aria-hidden>
        {cells.map(([x, y, f]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={FACTION_BY_ID[f]?.color ?? "#000"} opacity={0.62} />
        ))}
      </svg>
    </div>
  );
}
