import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import { ArchiveMap } from "@/components/ArchiveMap";
import { Divider } from "@/components/Ornaments";
import { PLAIN_WAX, WaxSeal } from "@/components/Seal";
import { FACTION_BY_ID, FACTION_IDS } from "@/lib/factions";
import { loadArchive } from "@/lib/game/archive";
import { getServerReadSupabase } from "@/lib/supabase/client";
import { roman } from "@/lib/roman";

export const revalidate = 3600; // a finished season never changes

type Props = { params: Promise<{ season: string }> };

async function read(season: string) {
  if (!/^\d{1,6}$/.test(season)) return null;
  const sb = getServerReadSupabase();
  return sb ? loadArchive(sb, Number(season)) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await read((await params).season).catch(() => null);
  return { title: a ? `Season ${roman(a.number)} · ${a.name} — The Chronicles` : "The Chronicles — $WERGILD" };
}

const day = (t: number) =>
  new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;

export default async function ArchiveSeasonPage({ params }: Props) {
  const a = await read((await params).season);
  if (!a) notFound();
  const win = a.winner ? FACTION_BY_ID[a.winner] : null;
  const ranked = FACTION_IDS.map((id) => ({ f: FACTION_BY_ID[id], pts: a.scores[id] ?? 0 })).sort((x, y) => y.pts - x.pts);
  const held = (id: string) => a.cells.filter((c) => c[2] === id).length;

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl">
        <Link href="/archive" className="text-sm text-gold/80 hover:text-gold hover:underline">
          ← The Chronicles
        </Link>
        <header className="mt-4 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <WaxSeal color={win?.color ?? PLAIN_WAX} crest={win?.crest} size={104} className="-rotate-6" title={win ? `Sealed by ${win.name}` : "Sealed in plain wax"} />
          <div>
            <h1 className="font-display text-2xl tracking-[0.2em] text-gold">SEASON {roman(a.number)}</h1>
            <p className="font-fell text-xl italic text-parchment/85">{a.name}</p>
            <p className="mt-1 text-xs text-parchment/50">
              {day(a.startsAt)} – {day(a.endsAt)} UTC
            </p>
            <p className="mt-2 text-parchment/85">
              {win ? (
                <>
                  Won by <span className="font-semibold text-gold">{win.name}</span> with{" "}
                  <span className="font-mono">{(a.scores[win.id] ?? 0).toLocaleString("en-US")}</span> points.
                </>
              ) : (
                "No Banner scored this season."
              )}
            </p>
          </div>
        </header>

        <section aria-label="The map at the knell" className="mt-8">
          <ArchiveMap cells={a.cells} className="w-full" />
          <p className="mt-2 text-center text-xs text-parchment/45">The map as it stood when the knell rang. Read-only.</p>
        </section>

        <Divider className="mt-8" />

        <div className="grid gap-8 md:grid-cols-2">
          <section aria-label="Banners">
            <h2 className="font-display text-sm tracking-[0.18em] text-gold">THE BANNERS</h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-gold/25 text-left text-[11px] uppercase tracking-wider text-parchment/45">
                  <th className="w-8 py-1.5 font-medium">#</th>
                  <th className="py-1.5 font-medium">Banner</th>
                  <th className="py-1.5 text-right font-medium">Cells</th>
                  <th className="py-1.5 text-right font-medium">Points</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(({ f, pts }, i) => (
                  <tr key={f.id} className="border-b border-white/5 text-parchment/85">
                    <td className="py-1.5 font-mono text-parchment/50">{i + 1}</td>
                    <td className="py-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.crest} alt="" className="h-4 w-auto" />
                        <Link href={`/banner/${f.id}`} className="hover:text-gold hover:underline">
                          {f.name}
                        </Link>
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-mono">{held(f.id)}</td>
                    <td className="py-1.5 text-right font-mono">{pts.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section aria-label="Top 10 Renown">
            <h2 className="font-display text-sm tracking-[0.18em] text-gold">THE TEN MOST RENOWNED</h2>
            {a.top.length === 0 ? (
              <p className="mt-3 font-fell italic text-parchment/55">Nobody earned Renown this season.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-gold/25 text-left text-[11px] uppercase tracking-wider text-parchment/45">
                    <th className="w-8 py-1.5 font-medium">#</th>
                    <th className="py-1.5 font-medium">Wallet</th>
                    <th className="py-1.5 font-medium">Banner</th>
                    <th className="py-1.5 text-right font-medium">Renown</th>
                  </tr>
                </thead>
                <tbody>
                  {a.top.map((p) => (
                    <tr key={p.wallet} className="border-b border-white/5 text-parchment/85">
                      <td className="py-1.5 font-mono text-parchment/50">{p.rank}</td>
                      <td className="py-1.5 font-mono" title={p.wallet}>
                        {short(p.wallet)}
                      </td>
                      <td className="py-1.5">{p.faction ? FACTION_BY_ID[p.faction].name : "—"}</td>
                      <td className="py-1.5 text-right font-mono">
                        {p.renown.toLocaleString("en-US", { maximumFractionDigits: p.renown < 100 ? 2 : 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </PageShell>
  );
}
