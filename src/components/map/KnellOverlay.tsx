"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FACTION_BY_ID } from "@/lib/factions";
import type { ArchiveSummary } from "@/lib/game/archive";
import { roman } from "@/lib/roman";
import { PLAIN_WAX, WaxSeal } from "@/components/Seal";

/**
 * End of a season (SPEC, Animations): the map rolls itself up, the scroll is sealed with
 * the winner's wax, and it leaves for the Chronicles. Pure CSS, about 3 s, then still.
 */
export function KnellOverlay({ season, onClose }: { season: ArchiveSummary; onClose: () => void }) {
  const win = season.winner ? FACTION_BY_ID[season.winner] : null;
  const pts = win ? (season.scores[win.id] ?? 0) : 0;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="knell-title"
      className="knell-backdrop fixed inset-0 z-50 overflow-y-auto bg-charcoal/95 backdrop-blur-[3px]"
    >
      <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center px-4 pb-10 pt-[6vh]">
        <p className="knell-caption font-display text-xs tracking-[0.35em] text-gold/80">THE KNELL HAS RUNG</p>

        {/* the map, rolling up into the scroll */}
        <div className="relative mt-10 w-full">
          <div className="knell-map relative overflow-hidden rounded-[2px] shadow-[0_10px_30px_rgba(0,0,0,0.6)]" style={{ aspectRatio: "48 / 30" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/map/world-1600.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className="knell-roller pointer-events-none absolute -inset-x-3 h-8 -translate-y-1/2 rounded-full sm:h-10">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="knell-seal">
                <WaxSeal color={win?.color ?? PLAIN_WAX} crest={win?.crest} size={92} title={win ? `Sealed by ${win.name}` : "Sealed"} />
              </div>
            </div>
          </div>
        </div>

        <div className="knell-text relative -mt-[52%] text-center">
          <h2 id="knell-title" className="font-display text-2xl tracking-[0.18em] text-gold sm:text-3xl">
            SEASON {roman(season.number)} IS OVER
          </h2>
          <p className="mt-1 font-fell text-lg italic text-parchment/80">{season.name}</p>
          <p className="mt-4 text-parchment/90">
            {win ? (
              <>
                <span style={{ color: win.color }} className="font-semibold brightness-125">
                  {win.name}
                </span>{" "}
                carry the season with <span className="font-mono">{pts.toLocaleString("en-US")}</span> points. Their
                banner is embroidered in the Hall of Fame.
              </>
            ) : (
              "No Banner held the field. The scroll is sealed in plain wax."
            )}
          </p>
          <p className="mt-1 text-sm text-parchment/55">
            The map is redrawn and every soldier is back in reserve. Seniority is kept.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              ref={closeRef}
              onClick={onClose}
              className="rounded-md bg-gold px-5 py-2 text-sm font-semibold text-charcoal hover:brightness-110"
            >
              To the new map
            </button>
            <Link
              href={`/archive/${season.number}`}
              className="rounded-md border border-gold/50 px-5 py-2 text-sm font-semibold text-gold hover:bg-gold/10"
            >
              Read the Chronicles
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const SEEN_KEY = "wg_seen_season";

/**
 * Plays the knell once per player and per season change: when the live season number is
 * higher than the last one this browser saw (also while the map is open), or with ?knell
 * in the URL (replays the latest one).
 */
export function useKnell(seasonNumber: number | null) {
  const [knell, setKnell] = useState<ArchiveSummary | null>(null);
  useEffect(() => {
    if (seasonNumber === null) return;
    const replay = new URLSearchParams(location.search).has("knell");
    let seen = NaN;
    try {
      seen = Number(localStorage.getItem(SEEN_KEY) ?? NaN);
      localStorage.setItem(SEEN_KEY, String(seasonNumber));
    } catch {
      /* private mode: no knell memory */
    }
    if (!replay && (!Number.isFinite(seen) || seen >= seasonNumber)) return;
    let alive = true;
    fetch("/api/archive")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: ArchiveSummary[]) => {
        const last = replay ? list[0] : list.find((a) => a.number >= seen && a.number < seasonNumber);
        if (alive && last) setKnell(last);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [seasonNumber]);
  return { knell, close: () => setKnell(null) };
}
