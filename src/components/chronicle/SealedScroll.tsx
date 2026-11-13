/* eslint-disable @next/next/no-img-element */

/**
 * A rolled chronicle (chronicle_scroll.webp) with its wax seal (wax_seal.webp) laid over the red
 * seal drawn on the scroll: centre at 55.8 % × 46.6 % of the scroll, 18 % of its width (measured: covers every red pixel).
 * The grey wax takes the winner's colour through a "color" blend (the hue of the Banner, the
 * lightness of the wax: its highlights stay), and the Banner's crest is pressed into it.
 * No colour = a season not yet sealed: plain grey wax, no crest.
 */
const SEAL = "/ornaments/web/wax_seal.webp";

export function SealedScroll({
  color = null,
  crest = null,
  className = "",
}: {
  color?: string | null;
  crest?: string | null;
  className?: string;
}) {
  return (
    <div className={`relative w-full ${className}`} style={{ aspectRatio: "1400 / 491" }}>
      <img src="/ornaments/web/chronicle_scroll.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
      <div
        className="absolute isolate aspect-[360/356] w-[18%] -translate-x-1/2 -translate-y-1/2"
        style={{ left: "55.8%", top: "46.6%" }}
      >
        <img src={SEAL} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
        {color && (
          <>
            {/* the Banner's hue, keeping the wax's lightness (and so its highlights) */}
            <div
              className="absolute inset-0"
              style={{
                background: color,
                mixBlendMode: "color",
                maskImage: `url(${SEAL})`,
                WebkitMaskImage: `url(${SEAL})`,
                maskSize: "100% 100%",
                WebkitMaskSize: "100% 100%",
              }}
            />
            {/* a little depth, so pale Banners still read as wax */}
            <div
              className="absolute inset-0 opacity-35"
              style={{
                background: color,
                mixBlendMode: "multiply",
                maskImage: `url(${SEAL})`,
                WebkitMaskImage: `url(${SEAL})`,
                maskSize: "100% 100%",
                WebkitMaskSize: "100% 100%",
              }}
            />
          </>
        )}
        {crest && (
          <img
            src={crest}
            alt=""
            draggable={false}
            className="absolute left-1/2 top-1/2 w-[45%] -translate-x-1/2 -translate-y-1/2 select-none opacity-70 mix-blend-multiply [filter:grayscale(0.35)_contrast(1.1)_drop-shadow(0_1px_0_rgba(255,255,255,0.35))]"
          />
        )}
      </div>
    </div>
  );
}
