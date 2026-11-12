"use client";

import { useSoundSetting } from "@/lib/sound";

const btn =
  "grid h-9 w-9 place-items-center rounded-md border border-gold/30 bg-charcoal/85 text-parchment/80 shadow-lg backdrop-blur-sm hover:border-gold/60 hover:text-gold";

/** Top-right of the map: capture for X, and the optional sounds (off by default). */
export function MapTools({ onCapture }: { onCapture: () => void }) {
  const [sound, setSound] = useSoundSetting();
  return (
    <div className="absolute right-2.5 top-[54px] z-10 flex flex-col gap-1.5 md:right-[68px] md:top-3 md:flex-row">
      <button className={btn} onClick={onCapture} aria-label="Capture the map to share on X" title="Capture the map">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4z" />
          <circle cx="12" cy="13.2" r="3.4" />
        </svg>
      </button>
      <button
        className={btn}
        onClick={() => setSound(!sound)}
        aria-pressed={sound}
        aria-label={sound ? "Sound on: switch off" : "Sound off: switch on"}
        title={sound ? "Sound on" : "Sound off"}
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 10h3.5L12 6v12l-4.5-4H4z" />
          {sound ? (
            <path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 7a7.3 7.3 0 0 1 0 10" />
          ) : (
            <path d="M16 10l4 4m0-4l-4 4" />
          )}
        </svg>
      </button>
    </div>
  );
}
