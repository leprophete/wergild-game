/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import { ArchiveMap } from "@/components/ArchiveMap";
import { Divider, Lore } from "@/components/Ornaments";
import { PointsHistory } from "@/components/PointsHistory";
import { FACTIONS, FACTION_BY_ID, FACTION_IDS, type FactionId } from "@/lib/factions";
import { loadBanner, type BannerPage } from "@/lib/game/banner";
import { roman } from "@/lib/roman";

export const revalidate = 60;

type Props = { params: Promise<{ name: string }> };

export function generateStaticParams() {
  return FACTION_IDS.map((name) => ({ name }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const f = FACTION_BY_ID[name as FactionId];
  return f ? { title: `${f.name} — $WERGILD`, description: `${f.name}: “${f.motto}”. Territory, members and points of the season.` } : {};
}

/** A few lines of lore per Banner (SPEC, "Les cinq Bannières"). */
const LORE: Record<FactionId, string> = {
  goblins:
    "Out of the Gnawing Pits they come, a crowned goblin head over two crossed daggers. What glitters is theirs, and they are quick to take it: the Goblins strike fast and count their gains.",
  changelings:
    "An empty cradle under a crescent moon. The Changelings were never anyone's, and they are patient: in the mists of the Cradle Fen, the old soldiers grow strong.",
  knaves:
    "A split mask and a key. From Knave's Hollow, the island in the river, the Knaves watch the bridges and take whatever is left unguarded. Nothing belongs to anyone.",
  unburied:
    "A crowned skull over two crossed gravedigger's spades. The Unburied fall and rise again from the Weeping Barrows: no grave can hold them, no dump can end them.",
  wretches:
    "A pitchfork and a torch, crossed. The Wretches are the many, the small holders of the Burnt Fields, and every one of them carries the war a little further.",
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-gold/20 bg-white/[0.03] px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-parchment/50">{label}</div>
      <div className="font-mono text-lg text-parchment">{value}</div>
      {hint && <div className="text-[11px] text-parchment/45">{hint}</div>}
    </div>
  );
}

export default async function BannerPageView({ params }: Props) {
  const { name } = await params;
  if (!FACTION_IDS.includes(name as FactionId)) notFound();
  const f = FACTION_BY_ID[name as FactionId];
  let b: BannerPage | null = null;
  try {
    b = await loadBanner(f.id);
  } catch (e) {
    console.error("banner page: read failed", e);
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        <Link href="/join" className="text-sm text-gold/80 hover:text-gold hover:underline">
          ← The Banners
        </Link>

        <header className="mt-4 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
          <div className="mx-auto flex flex-col items-center">
            <div className="h-1 w-40 rounded-full bg-gradient-to-r from-transparent via-gold/80 to-transparent" />
            <div className="banner-sway">
              <img src={f.banner} alt={`The banner of ${f.name}`} className="h-[260px] w-auto drop-shadow-[0_10px_16px_rgba(0,0,0,0.6)] sm:h-[340px]" />
            </div>
          </div>
          <div>
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-3xl tracking-[0.16em] text-gold">{f.name.toUpperCase()}</h1>
                <p className="mt-1 font-fell text-xl italic text-parchment/85">“{f.motto}”</p>
                <p className="mt-1 text-sm text-parchment/55">Homeland: {f.homeland}</p>
              </div>
              {/* the homeland vignette, framed */}
              <figure className="shrink-0 rounded-sm border border-gold/50 p-1 shadow-[0_6px_14px_rgba(0,0,0,0.55)]">
                <img src={f.homelandImg} alt={f.homeland} className="h-24 w-auto rounded-[2px] sm:h-32" />
              </figure>
            </div>
            <Lore className="mt-4">{LORE[f.id]}</Lore>

            {b ? (
              <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3">
                <Stat
                  label="Rank"
                  value={b.rank ? `#${b.rank} of 5` : "—"}
                  hint={b.season ? `Season ${roman(b.season.number)}` : "no season running"}
                />
                <Stat label="Points this season" value={fmt(b.points)} hint={`+${fmt(b.lastHour)} last hour`} />
                <Stat label="Members" value={fmt(b.members)} />
                <Stat label="Force" value={fmt(b.force)} hint={`${b.sharePct.toFixed(1)} % of all sworn force`} />
                <Stat label="Cells held" value={fmt(b.cells.length)} hint={`${b.towers} watchtower${b.towers === 1 ? "" : "s"}`} />
                <div className="flex items-center rounded-md border border-gold/20 bg-white/[0.03] px-3 py-2.5">
                  {b.telegram ? (
                    <a href={b.telegram} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-gold hover:underline">
                      The Banner&apos;s Telegram ↗
                    </a>
                  ) : (
                    <span className="text-xs text-parchment/45">The Banner&apos;s Telegram opens soon.</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-5 font-fell italic text-parchment/60">The heralds could not be reached. Try again in a moment.</p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/join" className="rounded-md bg-gold px-5 py-2 text-sm font-semibold text-charcoal hover:brightness-110">
                Swear to {f.name}
              </Link>
              <Link href="/map" className="rounded-md border border-gold/50 px-5 py-2 text-sm font-semibold text-gold hover:bg-gold/10">
                To the map
              </Link>
            </div>
          </div>
        </header>

        {b && (
          <>
            <Divider className="mt-10" />
            <section aria-labelledby="territory">
              <h2 id="territory" className="font-display text-sm tracking-[0.18em] text-gold">
                TERRITORY
              </h2>
              <ArchiveMap cells={b.cells.map(([x, y]) => [x, y, f.id])} className="mt-3 w-full" />
              <p className="mt-2 text-xs text-parchment/45">
                Every cell {f.name} hold right now. Live on <Link href="/map" className="underline hover:text-parchment">the map</Link>.
              </p>
            </section>

            <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
              <section aria-labelledby="history">
                <h2 id="history" className="font-display text-sm tracking-[0.18em] text-gold">
                  POINTS THIS SEASON
                </h2>
                <div className="mt-3">
                  {b.season ? (
                    <PointsHistory history={b.history} focus={f.id} startsAt={b.season.startsAt} endsAt={b.season.endsAt} />
                  ) : (
                    <p className="font-fell italic text-parchment/55">No season is running.</p>
                  )}
                </div>
              </section>

              <section aria-labelledby="top">
                <h2 id="top" className="font-display text-sm tracking-[0.18em] text-gold">
                  TOP CONTRIBUTORS
                </h2>
                {b.top.length === 0 ? (
                  <p className="mt-3 font-fell italic text-parchment/55">No Renown earned yet this season.</p>
                ) : (
                  <table className="mt-3 w-full text-sm">
                    <thead>
                      <tr className="border-b border-gold/25 text-left text-[11px] uppercase tracking-wider text-parchment/45">
                        <th className="w-8 py-1.5 font-medium">#</th>
                        <th className="py-1.5 font-medium">Wallet</th>
                        <th className="py-1.5 text-right font-medium">Renown</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.top.map((p) => (
                        <tr key={p.wallet} className="border-b border-white/5 text-parchment/85">
                          <td className="py-1.5 font-mono text-parchment/50">{p.rank}</td>
                          <td className="py-1.5 font-mono" title={p.wallet}>
                            {short(p.wallet)}
                          </td>
                          <td className="py-1.5 text-right font-mono">
                            {p.renown.toLocaleString("en-US", { maximumFractionDigits: p.renown < 100 ? 2 : 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="mt-2 text-xs text-parchment/45">
                  Renown: a cell&apos;s points shared among its holders, pro rata to their force there.{" "}
                  <Link href="/ranking" className="underline hover:text-parchment">
                    Full ranking
                  </Link>
                </p>
              </section>
            </div>
          </>
        )}

        <Divider className="mt-10" />
        <nav aria-label="The five Banners" className="flex flex-wrap justify-center gap-4">
          {FACTIONS.map((o) => (
            <Link
              key={o.id}
              href={`/banner/${o.id}`}
              aria-current={o.id === f.id ? "page" : undefined}
              className="flex flex-col items-center gap-1 rounded-md px-2 py-1 text-xs text-parchment/60 hover:text-parchment aria-[current=page]:text-gold"
            >
              <img src={o.crest} alt="" className="h-10 w-auto" />
              {o.name}
            </Link>
          ))}
        </nav>
      </div>
    </PageShell>
  );
}
