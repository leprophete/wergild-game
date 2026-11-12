"use client";

import type { FeedEntry } from "@/lib/map/state";
import { useNow } from "@/lib/useNow";

const ago = (ms: number) => {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ago`;
};

/** Discreet activity feed, written with the quill, bottom-left of the map. */
export function ActivityFeed({ entries }: { entries: FeedEntry[] }) {
  const now = useNow(30_000);
  return (
    <div className="pointer-events-none absolute bottom-4 left-11 z-10 max-w-[min(72vw,320px)] md:left-[68px]">
      <ul className="space-y-0.5 rounded-sm bg-parchment/80 px-3 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.5)] backdrop-blur-[1px]">
        {entries.slice(0, 4).map((e, i) => (
          <li
            key={e.id}
            className={`font-fell text-[13px] leading-snug text-ink ${i === 0 ? "feed-new" : ""} ${i > 1 ? "hidden md:block" : ""}`}
            style={{ opacity: 1 - i * 0.18 }}
          >
            {e.text}
            <span className="ml-1.5 text-[11px] italic text-ink/55" suppressHydrationWarning>
              · {ago(now - e.at)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
