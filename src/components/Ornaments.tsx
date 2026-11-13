/* eslint-disable @next/next/no-img-element */
import type { CSSProperties, ReactNode } from "react";
import { IlluminatedInitial } from "./IlluminatedInitial";

/**
 * Gilded ornaments (public/ornaments). They stay discreet: the map and the game
 * information come first, so they are small, slightly transparent and never stretched.
 */

/**
 * Where each corner's two tips sit, as a fraction of the corner's WIDTH (measured on the
 * images): the thin gold rules start exactly there, so they extend the tips.
 */
const TIPS = {
  tl: { h: 0.8, rule: 0.047, edge: 0.041 }, // h = height/width; rule = top rule offset; edge = left rule offset
  tr: { h: 0.894, rule: 0.053, edge: 0.059 },
  bl: { h: 0.8875, rule: 0.059, edge: 0.041 },
  br: { h: 0.994, rule: 0.0625, edge: 0.053 },
};

const c = (k: number) => `calc(var(--corner) * ${k})`;

/** The map's frame: four corners in the angles, joined by a fine gold rule (CSS). */
export function MapFrame() {
  const rule = "absolute bg-gradient-to-r from-gold/70 via-gold/55 to-gold/70";
  const vrule = "absolute bg-gradient-to-b from-gold/70 via-gold/55 to-gold/70";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-1 z-[5] opacity-90 [--corner:34px] md:inset-1.5 md:[--corner:58px]"
    >
      {/* rules: 1 px, overlapping the corners by 2 px so they meet the tips */}
      <div className={rule} style={{ height: 1, top: c((TIPS.tl.rule + TIPS.tr.rule) / 2), left: `calc(var(--corner) - 2px)`, right: `calc(var(--corner) - 2px)` }} />
      <div className={rule} style={{ height: 1, bottom: c((TIPS.bl.rule + TIPS.br.rule) / 2), left: `calc(var(--corner) - 2px)`, right: `calc(var(--corner) - 2px)` }} />
      <div className={vrule} style={{ width: 1, left: c((TIPS.tl.edge + TIPS.bl.edge) / 2), top: `calc(${c(TIPS.tl.h)} - 2px)`, bottom: `calc(${c(TIPS.bl.h)} - 2px)` }} />
      <div className={vrule} style={{ width: 1, right: c((TIPS.tr.edge + TIPS.br.edge) / 2), top: `calc(${c(TIPS.tr.h)} - 2px)`, bottom: `calc(${c(TIPS.br.h)} - 2px)` }} />
      {/* corners, never stretched: fixed width, natural height */}
      <img src="/ornaments/corner_top_left.png" alt="" className="absolute left-0 top-0 h-auto" style={{ width: "var(--corner)" }} />
      <img src="/ornaments/corner_top_right.png" alt="" className="absolute right-0 top-0 h-auto" style={{ width: "var(--corner)" }} />
      <img src="/ornaments/corner_bottom_left.png" alt="" className="absolute bottom-0 left-0 h-auto" style={{ width: "var(--corner)" }} />
      <img src="/ornaments/corner_bottom_right.png" alt="" className="absolute bottom-0 right-0 h-auto" style={{ width: "var(--corner)" }} />
    </div>
  );
}

/** Gilded band on top of a panel. */
export function PanelCrown({ className = "" }: { className?: string }) {
  return (
    <img
      src="/ornaments/border_horizontal.png"
      alt=""
      aria-hidden
      className={`pointer-events-none mx-auto block h-auto w-full max-w-[300px] opacity-80 ${className}`}
    />
  );
}

/** Winged divider between sections. */
export function Divider({ className = "" }: { className?: string }) {
  return (
    <img
      src="/ornaments/divider_wings.png"
      alt=""
      aria-hidden
      className={`pointer-events-none mx-auto my-4 block h-auto w-[150px] opacity-70 ${className}`}
    />
  );
}

/**
 * A lore text opening with an illuminated initial (lettrine): a burnished-gold capital on a
 * night-blue field of gold scrolls, with a red band, as in illuminated manuscripts.
 * Interface texts and numbers never get one.
 */
export function Lore({ children, className = "", style }: { children: string; className?: string; style?: CSSProperties }): ReactNode {
  const first = children.charAt(0);
  const rest = children.slice(1);
  return (
    <p className={`font-fell text-[15px] italic leading-relaxed text-parchment/75 ${className}`} style={style}>
      <IlluminatedInitial
        letter={first}
        className="float-left mb-1 mr-3 mt-1 h-[4.4em] w-[4.4em] drop-shadow-[0_3px_6px_rgba(0,0,0,0.6)]"
      />
      <span className="sr-only">{first}</span>
      {rest}
    </p>
  );
}
