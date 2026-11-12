"use client";

import type { MapFilter } from "@/lib/map/render";

type FilterId = Exclude<MapFilter, "all">;

const FILTERS: { id: FilterId; label: string; empty: string }[] = [
  { id: "mine", label: "My cells", empty: "You hold no cells right now" },
  { id: "contested", label: "Contested", empty: "No contested cells right now" },
  { id: "events", label: "Events", empty: "No event on the map right now" },
];

/**
 * Filter bar. Clicking a filter toggles it: clicking the active one again turns it off
 * and the map goes back to normal. When nothing matches, the map is not dimmed and a
 * short note says so.
 */
export function MapFilters({
  value,
  onToggle,
  matches,
}: {
  value: MapFilter;
  onToggle: (f: FilterId) => void;
  /** cells matching the active filter */
  matches: number;
}) {
  const active = FILTERS.find((f) => f.id === value);
  return (
    <div className="absolute left-11 top-3 z-10 flex flex-col items-start gap-1.5 md:left-[68px]">
      <div className="flex gap-1 rounded-md border border-gold/30 bg-charcoal/85 p-1 shadow-lg backdrop-blur-sm" role="group" aria-label="Map filters">
        {FILTERS.map((f) => {
          const on = value === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onToggle(f.id)}
              aria-pressed={on}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                on ? "bg-gold text-charcoal" : "text-parchment/75 hover:bg-white/5 hover:text-parchment"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      {active && matches === 0 && (
        <div role="status" className="rounded-md border border-gold/25 bg-charcoal/85 px-2.5 py-1 font-fell text-[13px] italic text-parchment/80 shadow-lg">
          {active.empty}
        </div>
      )}
    </div>
  );
}
