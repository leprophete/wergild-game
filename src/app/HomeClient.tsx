"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BUY_URL, TOKENS_PER_SOLDIER } from "@config/game";
import { FACTIONS } from "@/lib/factions";
import { payloadToCells, type MapPayload } from "@/lib/map/remote";
import { useLiveMap } from "@/lib/map/useLiveMap";
import { roman } from "@/lib/roman";
import { supabaseConfigured } from "@/lib/supabase/client";
import MapCanvas from "@/components/map/MapCanvas";
import { Countdown } from "@/components/map/TopBar";
import { Conquer, RaiseArmy } from "@/components/Engravings";
import { Divider } from "@/components/Ornaments";

/* eslint-disable @next/next/no-img-element */

const corner = "pointer-events-none absolute w-[18%] max-w-[86px] opacity-90";

/** The closed grimoire "$WERGILD — Season N". A click opens it on the live map. */
function Grimoire({ payload }: { payload: MapPayload | null }) {
  const [open, setOpen] = useState(false);
  const seasonNumber = payload?.season.number ?? null;
  const seasonName = payload?.season.name ?? null;
  const cells = useMemo(() => (payload ? payloadToCells(payload) : []), [payload]);

  return (
    <div className="mx-auto w-full max-w-4xl [perspective:2200px]">
      <div className="relative">
        {/* the page under the cover: the live map */}
        <div className="relative overflow-hidden rounded-r-md rounded-l-sm border border-[#5a4022] bg-[#e6d8b8] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.65)] sm:p-3">
          <div className="relative overflow-hidden rounded-[2px]" style={{ aspectRatio: "48 / 30" }}>
            {open && payload ? (
              <MapCanvas
                preview
                cells={cells}
                myFaction={null}
                selectedId={null}
                filter="all"
                events={payload.events}
                seasonTitle={payload.season.name}
                seasonSub={`Season ${roman(payload.season.number)} of $WERGILD · the war of the five Banners`}
                onSelect={() => {}}
              />
            ) : (
              <img src="/map/world@1x.webp" alt="" className="h-full w-full object-cover opacity-90" />
            )}
            {open && (
              <Link
                href="/map"
                className="absolute bottom-3 right-3 z-10 rounded-md bg-charcoal/85 px-3 py-1.5 text-xs font-semibold text-gold ring-1 ring-gold/50 hover:bg-charcoal"
              >
                Enter the war →
              </Link>
            )}
          </div>
        </div>

        {/* the leather cover, hinged on the left */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open the grimoire on the live map"
          aria-expanded={open}
          disabled={open}
          className={`grimoire-cover absolute inset-0 origin-left rounded-r-md rounded-l-sm text-left [transform-style:preserve-3d] ${open ? "is-open" : ""}`}
        >
          <span className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-r-md rounded-l-sm border border-[#1a0f08] bg-[radial-gradient(ellipse_at_40%_35%,#4a2e1c_0%,#2d1a10_55%,#170d07_100%)] px-6 text-center shadow-[inset_0_0_60px_rgba(0,0,0,0.75),0_18px_40px_rgba(0,0,0,0.7)] [backface-visibility:hidden]">
            {/* leather grain and the spine */}
            <span className="absolute inset-0 opacity-[0.18] [background:repeating-radial-gradient(circle_at_30%_40%,transparent_0,transparent_2px,rgba(0,0,0,0.5)_3px,transparent_4px)]" />
            <span className="absolute inset-y-0 left-0 w-[5%] bg-gradient-to-r from-black/60 via-[#3a2416]/40 to-transparent" />
            {/* gilded double rule and corners */}
            <span className="absolute inset-[4%] rounded-sm border border-gold/60" />
            <span className="absolute inset-[5.3%] rounded-sm border border-gold/30" />
            <img src="/ornaments/corner_top_left.png" alt="" className={`${corner} left-[3%] top-[3%]`} />
            <img src="/ornaments/corner_top_right.png" alt="" className={`${corner} right-[3%] top-[3%]`} />
            <img src="/ornaments/corner_bottom_left.png" alt="" className={`${corner} bottom-[3%] left-[3%]`} />
            <img src="/ornaments/corner_bottom_right.png" alt="" className={`${corner} bottom-[3%] right-[3%]`} />

            <span className="relative font-display text-[clamp(30px,8vw,72px)] font-bold tracking-[0.14em] text-gold [text-shadow:0_2px_0_#1a0f08,0_-1px_0_rgba(255,230,160,0.35),0_0_18px_rgba(201,162,75,0.35)]">
              $WERGILD
            </span>
            <img src="/ornaments/divider_wings.png" alt="" className="relative my-1 w-[34%] max-w-[220px] opacity-80 sm:my-2" />
            <span className="relative font-display text-[clamp(11px,2.2vw,18px)] tracking-[0.3em] text-gold/90">
              {seasonNumber === null ? "THE WAR OF THE FIVE BANNERS" : `SEASON ${roman(seasonNumber)}`}
            </span>
            {seasonName && (
              <span className="relative mt-1 font-fell text-[clamp(13px,2.4vw,20px)] italic text-parchment/70">{seasonName}</span>
            )}
            <span className="relative mt-3 font-fell text-[clamp(12px,2vw,16px)] italic text-parchment/55 sm:mt-5">
              “Every token has a price in blood.”
            </span>
            <span className="grimoire-hint relative mt-3 rounded-full border border-gold/40 px-3 py-1 font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-gold/80 sm:mt-6">
              Open the grimoire
            </span>
          </span>
          {/* inside of the cover (seen while it swings) */}
          <span className="absolute inset-0 rounded-l-md rounded-r-sm bg-[linear-gradient(135deg,#5b3a2a,#3b2418)] [backface-visibility:hidden] [transform:rotateY(180deg)]" />
        </button>
      </div>
    </div>
  );
}

function Scroll({ n, title, children, art }: { n: number; title: string; children: React.ReactNode; art: React.ReactNode }) {
  return (
    <li className="relative px-2 pt-3">
      <div className="absolute inset-x-0 top-0 h-5 rounded-full bg-[linear-gradient(to_bottom,#4d3820,#b8925a_22%,#efdcae_42%,#c9a46a_64%,#5a4022)] shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
      <div className="mx-1 rounded-b-[3px] bg-[radial-gradient(ellipse_at_center,#efe3c6_0%,#e6d8b8_55%,#cdb88d_100%)] px-5 pb-5 pt-6 text-ink shadow-[inset_0_0_30px_rgba(110,80,40,0.35)]">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-bold text-[#8E1B1B]">{roman(n)}</span>
          <h3 className="font-display text-sm font-semibold tracking-[0.12em]">{title}</h3>
        </div>
        <div className="mt-2 h-20">{art}</div>
        <p className="mt-2 font-fell text-[15px] leading-snug text-ink/90">{children}</p>
      </div>
    </li>
  );
}

export default function HomeClient() {
  const { payload } = useLiveMap(supabaseConfigured);
  const season = payload?.season ?? null;

  return (
    <div className="-mt-2">
      <Grimoire payload={payload} />

      <div className="mt-8 flex flex-col items-center gap-5 text-center">
        {season && (
          <p className="font-mono text-sm text-parchment/70" suppressHydrationWarning>
            <span className="font-display text-xs tracking-[0.25em] text-gold/80">THE KNELL IN </span>
            <span className="text-lg text-parchment">
              <Countdown endsAt={season.endsAt} />
            </span>
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/map" className="min-w-[140px] rounded-md bg-gold px-6 py-2.5 text-center font-semibold text-charcoal hover:brightness-110">
            Play
          </Link>
          <a
            href={BUY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-[140px] rounded-md border border-gold/60 px-6 py-2.5 text-center font-semibold text-gold hover:bg-gold/10"
          >
            Buy $WERGILD ↗
          </a>
        </div>
      </div>

      <Divider className="mt-10" />

      <section aria-labelledby="how" className="mx-auto max-w-5xl">
        <h2 id="how" className="text-center font-display text-sm tracking-[0.25em] text-gold">
          THE WAR IN THREE SCROLLS
        </h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          <Scroll n={1} title="RAISE YOUR ARMY" art={<RaiseArmy className="h-full w-full" />}>
            Buy $WERGILD. Every {TOKENS_PER_SOLDIER.toLocaleString("en-US")} tokens in your wallet is one soldier, and
            soldiers held long enough become veterans.
          </Scroll>
          <Scroll
            n={2}
            title="SWEAR TO A BANNER"
            art={
              <div className="flex h-full items-end justify-center gap-2">
                {FACTIONS.map((f) => (
                  <img key={f.id} src={f.crest} alt={f.name} title={f.name} className="h-12 w-auto drop-shadow-[0_2px_2px_rgba(42,31,20,0.4)] sm:h-14" />
                ))}
              </div>
            }
          >
            Five Banners, five creeds. Pick yours: your soldiers will fight under its colours all season long.
          </Scroll>
          <Scroll n={3} title="CONQUER THE MAP" art={<Conquer className="h-full w-full" />}>
            Place your soldiers next to your Banner&apos;s land. The strongest Banner holds the field, and every hour each
            field held scores. Sell, and your land fades.
          </Scroll>
        </ol>
      </section>

      <footer className="mx-auto mt-14 max-w-2xl text-center text-xs leading-relaxed text-parchment/45">
        <nav className="mb-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm text-parchment/70">
          <Link href="/rules" className="hover:text-parchment">
            The Rules
          </Link>
          <Link href="/ranking" className="hover:text-parchment">
            The Ranking
          </Link>
          <Link href="/archive" className="hover:text-parchment">
            The Chronicles
          </Link>
        </nav>
        $WERGILD is a memecoin. It has no guaranteed value and no promise of gain; you can lose everything you put in.
        The game gives no money reward. <Link href="/rules#risks" className="underline hover:text-parchment">Read the risks.</Link>
      </footer>
    </div>
  );
}
