/* eslint-disable @next/next/no-img-element */
import { COMPASS_ON_FRAME, CARTOUCHE_ON_FRAME, FRAME_RECT, RIDER_RECT } from "@/lib/map/illuminations";
import type { WorldRect } from "@/lib/map/imagery";

const box = (r: WorldRect) => ({ left: r.x0, top: r.y0, width: r.x1 - r.x0, height: r.y1 - r.y0 });
const INK = "#2A1F14";

/**
 * The map's illuminations, positioned in world units inside MapCanvas's overlay layer (which
 * follows pan and zoom and never catches the pointer): the frame, the season cartouche and the
 * compass rose on its bands, and the rider who fades to 25 % while the mouse is over him
 * (MapCanvas sets data-fade on the layer).
 */
export function MapIlluminations({ title, sub }: { title: string; sub: string }) {
  const c = CARTOUCHE_ON_FRAME;
  const k = COMPASS_ON_FRAME;
  return (
    <>
      <img src="/ornaments/web/map_frame.webp" alt="" draggable={false} className="absolute max-w-none select-none" style={box(FRAME_RECT)} />

      {/* the season cartouche, on the bottom band */}
      <div
        className="absolute flex flex-col items-center justify-center rounded-[3px] border-[1.5px] bg-[#efe4c8] text-center shadow-[0_3px_8px_rgba(0,0,0,0.45)]"
        style={{ left: c.cx - c.w / 2, top: c.cy - c.h / 2, width: c.w, height: c.h, borderColor: INK, color: INK }}
      >
        <div className="pointer-events-none absolute inset-[4px] rounded-[2px] border-[0.75px]" style={{ borderColor: INK }} />
        <div className="font-display text-[19px] font-semibold leading-none tracking-[0.1em]">{(title ?? "").toUpperCase()}</div>
        <div className="mt-[6px] font-fell text-[12px] italic leading-none opacity-85">{sub}</div>
      </div>

      {/* the compass rose, on the top band */}
      <svg
        viewBox="-50 -58 100 108"
        className="absolute overflow-visible drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
        style={{ left: k.cx - k.r * 1.5, top: k.cy - k.r * 1.62, width: k.r * 3, height: k.r * 3.24 }}
      >
        <circle r="34" fill="#ecdfbe" stroke={INK} strokeWidth="1.2" />
        <circle r="29" fill="none" stroke={INK} strokeWidth="0.8" />
        {[45, 135, 225, 315].map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <path d="M0 0 L0 -20 L-4 0 Z" fill={INK} />
            <path d="M0 0 L0 -20 L4 0 Z" fill="#E6D8B8" stroke={INK} strokeWidth="0.7" />
          </g>
        ))}
        {[0, 90, 180, 270].map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <path d="M0 0 L0 -40 L-6 0 Z" fill={INK} />
            <path d="M0 0 L0 -40 L6 0 Z" fill="#E6D8B8" stroke={INK} strokeWidth="0.8" />
          </g>
        ))}
        <text y="-45" textAnchor="middle" fontSize="13" fontFamily="var(--nf-cinzel), serif" fill={INK} stroke="#efe4c8" strokeWidth="3" paintOrder="stroke">
          N
        </text>
      </svg>

      <img
        src="/ornaments/web/map_rider.webp"
        alt=""
        draggable={false}
        className="map-rider absolute max-w-none -scale-x-100 select-none drop-shadow-[0_8px_14px_rgba(0,0,0,0.55)]"
        style={box(RIDER_RECT)}
      />
    </>
  );
}
