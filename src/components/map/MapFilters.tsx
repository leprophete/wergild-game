"use client";

import type { MapFilter } from "@/lib/map/render";

const FILTERS: { id: Exclude<MapFilter, "all">; label: string }[] = [
  { id: "mine", label: "My cells" },
  { id: "contested", label: "Contested" },
  { id: "events", label: "Events" },
];

export function MapFilters({ value, onChange }: { value: MapFilter; onChange: (f: MapFilter) => void }) {
  return (
    <div className="absolute left-3 top-3 z-10 flex gap-1 rounded-md border border-gold/30 bg-charcoal/85 p-1 shadow-lg backdrop-blur-sm">
      {FILTERS.map((f) => {
        const on = value === f.id;
        return (
          <button
            key={f.id}
            onClick={() => onChange(on ? "all" : f.id)}
            aria-pressed={on}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              on ? "bg-gold text-charcoal" : "text-parchment/75 hover:bg-white/5 hover:text-parchment"
            }`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
