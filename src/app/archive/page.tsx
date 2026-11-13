/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import PageShell from "@/components/PageShell";
import { Divider, Lore } from "@/components/Ornaments";
import { Countdown } from "@/components/map/TopBar";
import { SealedScroll } from "@/components/chronicle/SealedScroll";
import { ChronicleSeason } from "@/components/chronicle/ChronicleSeason";
import { FACTIONS, FACTION_BY_ID, type FactionId } from "@/lib/factions";
import { listArchives, loadCurrentSeason, type ArchiveSummary, type CurrentSeason } from "@/lib/game/archive";
import { getServerReadSupabase } from "@/lib/supabase/client";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getSessionWallet } from "@/lib/auth/session";
import { roman } from "@/lib/roman";

export const metadata: Metadata = { title: "The Chronicles — $WERGILD" };
// "Your chronicle" depends on who is signed in
export const dynamic = "force-dynamic";

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;

type MyLine = { number: number; name: string; faction: FactionId | null; rank: number | null; renown: number; current: boolean };

async function myChronicle(wallet: string): Promise<MyLine[]> {
  const sb = getAdminSupabase();
  const [{ data: past }, { data: active }] = await Promise.all([
    sb.from("season_players").select("faction_id, rank, renown, seasons!inner(number, name)").eq("wallet", wallet),
    sb.from("seasons").select("id, number, name").eq("status", "active").maybeSingle(),
  ]);
  const lines: MyLine[] = (past ?? []).map((r) => {
    const s = r.seasons as unknown as { number: number; name: string };
    return { number: s.number, name: s.name, faction: r.faction_id as FactionId | null, rank: r.rank, renown: Number(r.renown), current: false };
  });
  if (active) {
    const [{ data: mine }, { data: player }] = await Promise.all([
      sb.from("player_scores").select("renown").eq("season_id", active.id).eq("wallet", wallet).maybeSingle(),
      sb.from("players").select("faction_id").eq("wallet", wallet).maybeSingle(),
    ]);
    const renown = Number(mine?.renown ?? 0);
    let rank: number | null = null;
    if (renown > 0) {
      const { count } = await sb
        .from("player_scores")
        .select("wallet", { count: "exact", head: true })
        .eq("season_id", active.id)
        .gt("renown", renown);
      rank = (count ?? 0) + 1;
    }
    if (player?.faction_id || renown > 0)
      lines.push({ number: active.number, name: active.name, faction: (player?.faction_id ?? null) as FactionId | null, rank, renown, current: true });
  }
  return lines.sort((a, b) => b.number - a.number);
}

export default async function ArchivePage() {
  const sb = getServerReadSupabase();
  let seasons: ArchiveSummary[] = [];
  let current: CurrentSeason | null = null;
  let failed = false;
  try {
    [seasons, current] = sb ? await Promise.all([listArchives(sb), loadCurrentSeason(sb)]) : [[], null];
  } catch (e) {
    console.error("archive page: read failed", e);
    failed = true;
  }
  const wallet = await getSessionWallet();
  let mine: MyLine[] | null = null;
  if (wallet) {
    try {
      mine = await myChronicle(wallet);
    } catch (e) {
      console.error("archive page: my chronicle failed", e);
    }
  }

  // Hall of Fame
  const wins = Object.fromEntries(FACTIONS.map((f) => [f.id, 0])) as Record<FactionId, number>;
  for (const s of seasons) if (s.winner) wins[s.winner]++;
  const highest = seasons
    .filter((s) => s.winner)
    .map((s) => ({ s, pts: s.scores[s.winner!] ?? 0 }))
    .sort((a, b) => b.pts - a.pts)[0];
  const renowned = seasons
    .filter((s) => s.champion)
    .map((s) => ({ s, c: s.champion! }))
    .sort((a, b) => b.c.renown - a.c.renown)[0];

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl">
        <header className="text-center">
          <h1 className="font-display text-2xl tracking-[0.2em] text-gold">THE CHRONICLES</h1>
        </header>
        <Lore className="mx-auto mt-5 max-w-2xl text-[16px]">
          Here are kept the seasons of the war. When the knell tolls, the map is rolled, sealed in its winner&apos;s wax and
          laid among these scrolls, with the names of the most renowned and the deeds that were sung that season.
        </Lore>

        <Divider className="mt-8" />

        {/* the season still being written: a scroll not yet sealed */}
        {current && (
          <section aria-label="The season being written" className="mx-auto max-w-3xl">
            <SealedScroll className="opacity-95 drop-shadow-[0_10px_18px_rgba(0,0,0,0.6)]" />
            <div className="mt-2 text-center">
              <h2 className="font-display text-lg tracking-[0.16em] text-gold">
                SEASON {roman(current.number)} — <span className="font-fell italic tracking-normal">still being written</span>
              </h2>
              <p className="font-fell text-lg italic text-parchment/80">{current.name}</p>
              <p className="mt-2 font-mono text-sm text-parchment/75" suppressHydrationWarning>
                <span className="font-display text-xs tracking-[0.25em] text-gold/80">THE KNELL IN </span>
                <span className="text-lg text-parchment">
                  <Countdown endsAt={current.endsAt} />
                </span>
              </p>
              {current.leader ? (
                <p className="mt-2 inline-flex items-center gap-2 text-parchment/85">
                  <img src={FACTION_BY_ID[current.leader].crest} alt="" className="h-7 w-auto" />
                  {FACTION_BY_ID[current.leader].name} lead with <span className="font-mono">{n(current.leaderPoints)}</span> points
                </p>
              ) : (
                <p className="mt-2 text-parchment/70">No Banner has scored yet.</p>
              )}
              <div className="mt-4">
                <Link href="/map" className="inline-block rounded-md bg-gold px-6 py-2.5 font-semibold text-charcoal hover:brightness-110">
                  Join the war
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* the sealed seasons */}
        <section aria-label="Sealed seasons" className="mt-12 space-y-12">
          {failed ? (
            <p className="text-center font-fell italic text-parchment/60">The Chronicles could not be opened. Try again in a moment.</p>
          ) : seasons.length === 0 ? (
            <p className="text-center font-fell text-lg italic text-parchment/60">No season has been sealed yet. The first knell will fill this shelf.</p>
          ) : (
            seasons.map((s) => <ChronicleSeason key={s.number} s={s} />)
          )}
        </section>

        <Divider className="mt-12" />

        {/* Hall of Fame: every Banner, a star per victory, and two records */}
        <section aria-labelledby="hall" className="text-center">
          <h2 id="hall" className="font-display text-sm tracking-[0.2em] text-gold">
            HALL OF FAME
          </h2>
          <div className="relative mx-auto mt-4 max-w-3xl">
            <div className="absolute inset-x-0 top-0 h-[4px] rounded-full bg-gradient-to-r from-transparent via-gold/80 to-transparent" />
            <ol className="flex flex-wrap justify-around gap-y-6 pt-1">
              {FACTIONS.map((f, i) => (
                <li key={f.id} className="flex w-[18%] min-w-[96px] flex-col items-center">
                  <Link href={`/banner/${f.id}`} className="banner-sway block" style={{ animationDelay: `${-i * 0.9}s` }}>
                    <img src={f.banner} alt={f.name} className={`h-36 w-auto drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)] sm:h-44 ${wins[f.id] ? "" : "opacity-60 grayscale-[40%]"}`} />
                  </Link>
                  <div className="mt-2 h-5 text-lg leading-none text-gold" aria-label={`${wins[f.id]} victories`}>
                    {wins[f.id] ? "★".repeat(Math.min(wins[f.id], 10)) + (wins[f.id] > 10 ? ` ×${wins[f.id]}` : "") : <span className="text-parchment/30">☆</span>}
                  </div>
                  <div className="mt-1 font-display text-xs tracking-[0.06em] text-parchment/80">{f.name}</div>
                </li>
              ))}
            </ol>
          </div>
          <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-gold/25 bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-parchment/50">Greatest season</div>
              {highest ? (
                <div className="mt-1 text-parchment/90">
                  {FACTION_BY_ID[highest.s.winner!].name} · <span className="font-mono">{n(highest.pts)}</span> pts
                  <div className="text-xs text-parchment/50">Season {roman(highest.s.number)}</div>
                </div>
              ) : (
                <div className="mt-1 font-fell italic text-parchment/55">Not yet won.</div>
              )}
            </div>
            <div className="rounded-md border border-gold/25 bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-parchment/50">Most renowned</div>
              {renowned ? (
                <div className="mt-1 text-parchment/90">
                  <span className="font-mono">{short(renowned.c.wallet)}</span> · <span className="font-mono">{n(renowned.c.renown)}</span> Renown
                  <div className="text-xs text-parchment/50">
                    Season {roman(renowned.s.number)}
                    {renowned.c.faction ? ` · ${FACTION_BY_ID[renowned.c.faction].name}` : ""}
                  </div>
                </div>
              ) : (
                <div className="mt-1 font-fell italic text-parchment/55">Not yet sung.</div>
              )}
            </div>
          </div>
        </section>

        {/* signed in: the player's own seasons */}
        {mine && (
          <>
            <Divider className="mt-12" />
            <section aria-labelledby="mine" className="mx-auto max-w-2xl">
              <h2 id="mine" className="text-center font-display text-sm tracking-[0.2em] text-gold">
                YOUR CHRONICLE
              </h2>
              {mine.length === 0 ? (
                <p className="mt-3 text-center font-fell italic text-parchment/60">Your name is not in the Chronicles yet. Swear to a Banner and take a field.</p>
              ) : (
                <ol className="mt-3">
                  {mine.map((l) => {
                    const f = l.faction ? FACTION_BY_ID[l.faction] : null;
                    return (
                      <li key={l.number} className="flex items-center gap-3 border-b border-white/10 py-2">
                        <span className="w-24 font-display text-xs tracking-[0.12em] text-gold">SEASON {roman(l.number)}</span>
                        {f ? <img src={f.crest} alt="" className="h-7 w-auto" /> : <span className="w-6" />}
                        <span className="min-w-0 flex-1 text-parchment/85">
                          {f?.name ?? "No Banner"}
                          {l.current && <span className="ml-2 text-xs text-parchment/50">(still being written)</span>}
                        </span>
                        <span className="text-right font-mono text-sm text-parchment">
                          {l.rank ? `#${l.rank}` : "—"}
                          <span className="block text-[11px] text-parchment/55">{n(l.renown)} Renown</span>
                        </span>
                        {l.rank !== null && l.rank <= 10 && !l.current && (
                          <span className="rounded border border-gold/50 px-1.5 py-0.5 text-[11px] text-gold" title="Top 10: a badge for ever">
                            Badge
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}
