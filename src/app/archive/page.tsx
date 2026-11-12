import type { Metadata } from "next";
import Link from "next/link";
import PageShell from "@/components/PageShell";
import { Divider, Lore } from "@/components/Ornaments";
import { PLAIN_WAX, WaxSeal } from "@/components/Seal";
import { FACTION_BY_ID } from "@/lib/factions";
import { listArchives, type ArchiveSummary } from "@/lib/game/archive";
import { getServerReadSupabase } from "@/lib/supabase/client";
import { roman } from "@/lib/roman";

export const metadata: Metadata = { title: "The Chronicles — $WERGILD" };
export const revalidate = 60;

const day = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function ArchivePage() {
  const sb = getServerReadSupabase();
  let seasons: ArchiveSummary[] = [];
  let failed = false;
  try {
    seasons = sb ? await listArchives(sb) : [];
  } catch (e) {
    console.error("archive page: read failed", e);
    failed = true;
  }
  const winners = seasons.filter((s) => s.winner).slice().reverse();

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl">
        <header className="text-center">
          <h1 className="font-display text-2xl tracking-[0.2em] text-gold">THE CHRONICLES</h1>
          <p className="mt-1 font-fell text-lg italic text-parchment/75">Every season, rolled and sealed in its winner&apos;s wax.</p>
        </header>

        <section aria-label="Hall of Fame" className="mt-8">
          <h2 className="text-center font-display text-sm tracking-[0.18em] text-gold">HALL OF FAME</h2>
          {winners.length === 0 ? (
            <Lore className="mt-3 text-center">No banner has been embroidered yet. The first knell will tell.</Lore>
          ) : (
            <div className="relative mx-auto mt-4 max-w-3xl">
              <div className="absolute inset-x-0 top-0 h-[4px] rounded-full bg-gradient-to-r from-transparent via-gold/80 to-transparent" />
              <ol className="flex flex-wrap justify-center gap-x-5 gap-y-6 pt-1">
                {winners.map((s) => {
                  const f = FACTION_BY_ID[s.winner!];
                  return (
                    <li key={s.number}>
                      <Link href={`/archive/${s.number}`} className="group flex flex-col items-center" title={`${f.name}, Season ${roman(s.number)}`}>
                        <div className="banner-sway">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={f.banner} alt="" className="h-28 w-auto drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)] transition group-hover:brightness-110" />
                        </div>
                        <span className="mt-1 font-display text-[11px] tracking-[0.1em] text-gold">SEASON {roman(s.number)}</span>
                        <span className="text-[11px] text-parchment/60">{f.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </section>

        <Divider className="mt-10" />

        <section aria-label="Past seasons">
          {failed ? (
            <p className="text-center font-fell italic text-parchment/60">The Chronicles could not be opened. Try again in a moment.</p>
          ) : seasons.length === 0 ? (
            <Lore className="text-center">The Chronicles are still blank. When a season ends, its map is rolled, sealed and kept here.</Lore>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {seasons.map((s) => {
                const f = s.winner ? FACTION_BY_ID[s.winner] : null;
                return (
                  <li key={s.number}>
                    <Link
                      href={`/archive/${s.number}`}
                      className="group flex items-center gap-4 rounded-md border border-gold/20 bg-white/[0.03] p-4 transition hover:border-gold/50 hover:bg-white/[0.05]"
                    >
                      {/* a rolled scroll, sealed */}
                      <div className="relative h-16 w-24 shrink-0">
                        <div className="absolute inset-x-0 top-1/2 h-6 -translate-y-1/2 rounded-full bg-[linear-gradient(to_bottom,#4d3820,#b8925a_22%,#efdcae_42%,#c9a46a_64%,#5a4022)] shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-6">
                          <WaxSeal color={f?.color ?? PLAIN_WAX} crest={f?.crest} size={52} />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="font-display text-sm tracking-[0.1em] text-gold">SEASON {roman(s.number)}</div>
                        <div className="truncate font-fell text-lg italic text-parchment/85">{s.name}</div>
                        <div className="text-xs text-parchment/50">
                          {day(s.startsAt)} – {day(s.endsAt)} · {f ? `${f.name}, ${(s.scores[f.id] ?? 0).toLocaleString("en-US")} pts` : "no winner"}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}
