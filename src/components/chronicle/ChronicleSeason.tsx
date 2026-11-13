"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FACTIONS, FACTION_BY_ID } from "@/lib/factions";
import type { ArchivePage, ArchiveSummary } from "@/lib/game/archive";
import { STATIC_CELLS, cellId, cellLabel } from "@/lib/map/layout";
import type { CellState } from "@/lib/map/state";
import { roman } from "@/lib/roman";
import MapCanvas from "@/components/map/MapCanvas";
import { SealedScroll } from "./SealedScroll";

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;
const day = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** One finished season: a sealed scroll that unrolls, on click, into its page of the Chronicles. */
export function ChronicleSeason({ s, initial = null }: { s: ArchiveSummary; initial?: ArchivePage | null }) {
  const [open, setOpen] = useState(!!initial);
  const [page, setPage] = useState<ArchivePage | null>(initial);
  const [failed, setFailed] = useState(false);
  const win = s.winner ? FACTION_BY_ID[s.winner] : null;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !page) {
      try {
        const r = await fetch(`/api/archive/${s.number}`);
        if (!r.ok) throw new Error(String(r.status));
        setPage(await r.json());
      } catch {
        setFailed(true);
      }
    }
  };

  return (
    <article className="mx-auto w-full max-w-3xl">
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`chronicle-${s.number}`}
        className="group block w-full text-left transition-transform duration-300 hover:-translate-y-0.5"
      >
        <SealedScroll color={win?.color ?? null} crest={win?.crest ?? null} className="drop-shadow-[0_10px_18px_rgba(0,0,0,0.6)]" />
        <div className="mt-1 text-center">
          <div className="font-display text-sm tracking-[0.2em] text-gold">SEASON {roman(s.number)}</div>
          <div className="font-fell text-xl italic text-parchment/90">{s.name}</div>
          <div className="text-xs text-parchment/55">
            {day(s.startsAt)} – {day(s.endsAt)} · {win ? `${win.name}, ${n(s.scores[win.id] ?? 0)} pts` : "no winner"}
          </div>
          <div className="mt-1 text-xs text-gold/80 group-hover:underline">{open ? "Roll it up ▲" : "Unroll the chronicle ▼"}</div>
        </div>
      </button>

      {/* the scroll unrolls: its height opens from 0 */}
      <div
        id={`chronicle-${s.number}`}
        className={`grid transition-[grid-template-rows,opacity] duration-700 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          {open && (
            <div className="mt-4 rounded-[3px] bg-[#c69d63] bg-[linear-gradient(rgba(222,192,140,0.45),rgba(222,192,140,0.45)),url(/ornaments/web/grimoire_paper.webp)] bg-[length:100%_100%] px-6 py-8 text-ink shadow-[inset_0_0_40px_rgba(36,19,10,0.55),0_10px_24px_rgba(0,0,0,0.5)] sm:px-10">
              {failed ? (
                <p className="font-fell text-lg italic">The scribe could not find this page. Try again in a moment.</p>
              ) : !page ? (
                <p className="font-fell text-lg italic">The scroll unrolls…</p>
              ) : (
                <ChroniclePage page={page} />
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ChroniclePage({ page }: { page: ArchivePage }) {
  const win = page.winner ? FACTION_BY_ID[page.winner] : null;
  const cells = useMemo<CellState[]>(() => {
    const owners = new Map(page.cells.map(([x, y, f]) => [cellId(x, y), f]));
    return STATIC_CELLS.map((c) => ({ id: c.id, owner: owners.get(c.id) ?? null, forces: {}, mine: 0, wetUntil: null, contested: false }));
  }, [page.cells]);
  const ranked = FACTIONS.map((f) => ({ f, pts: page.scores[f.id] ?? 0 })).sort((a, b) => b.pts - a.pts);
  const max = Math.max(1, ranked[0].pts);
  const m = page.moments ?? {};
  // the absolute link is only known in the browser: set after mount, so the server HTML matches
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(location.origin), []);
  const url = `${origin}/archive/${page.number}`;
  const text = win
    ? `Season ${roman(page.number)} of $WERGILD is sealed: ${win.name} won with ${n(page.scores[win.id] ?? 0)} points.`
    : `Season ${roman(page.number)} of $WERGILD is sealed.`;
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-7">
      <header className="text-center">
        <h3 className="font-display text-2xl tracking-[0.14em]">Season {roman(page.number)}</h3>
        <p className="font-fell text-xl italic">{page.name}</p>
        {win && (
          <p className="mt-2 flex flex-col items-center gap-1 font-display text-lg sm:flex-row sm:justify-center sm:gap-2">
            <img src={win.crest} alt="" className="h-9 w-auto" />
            {win.name} carried the season
          </p>
        )}
      </header>

      {/* the map as it stood at the knell, read-only */}
      <section aria-label="The map at the knell">
        <div className="relative overflow-hidden rounded-sm border border-ink/40 shadow-[0_4px_12px_rgba(36,19,10,0.45)]" style={{ aspectRatio: "48 / 30" }}>
          <MapCanvas
            preview
            cells={cells}
            myFaction={null}
            selectedId={null}
            filter="all"
            events={[]}
            seasonTitle={page.name}
            seasonSub={`Season ${roman(page.number)} of $WERGILD · sealed at the knell`}
            onSelect={() => {}}
          />
        </div>
        <p className="mt-1 text-center text-xs italic text-ink/75">The map as it stood when the knell rang.</p>
      </section>

      <div className="grid gap-7 md:grid-cols-2">
        <section aria-label="The Banners">
          <h4 className="font-display text-sm font-bold tracking-[0.2em]">THE BANNERS</h4>
          <ol className="mt-2 space-y-2">
            {ranked.map(({ f, pts }, i) => (
              <li key={f.id} className="flex items-center gap-2.5">
                <span className="w-4 text-right font-display text-sm">{i + 1}</span>
                <img src={f.crest} alt="" className="h-7 w-auto" />
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between font-display text-[15px]">
                    <Link href={`/banner/${f.id}`} className="hover:underline">
                      {f.name}
                    </Link>
                    <span className="font-mono">{n(pts)}</span>
                  </span>
                  <span className="mt-0.5 block h-1.5 rounded-full bg-ink/15">
                    <span className="block h-full rounded-full" style={{ width: `${(pts / max) * 100}%`, background: f.color }} />
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Top 10 Renown">
          <h4 className="font-display text-sm font-bold tracking-[0.2em]">THE TEN MOST RENOWNED</h4>
          {page.top.length === 0 ? (
            <p className="mt-2 font-fell italic">Nobody earned Renown this season.</p>
          ) : (
            <ol className="mt-2">
              {page.top.map((p) => (
                <li key={p.wallet} className="flex items-center gap-2.5 border-b border-ink/25 py-1">
                  <span className="w-5 text-right font-display text-sm">{p.rank}</span>
                  {p.faction ? <img src={FACTION_BY_ID[p.faction].crest} alt={FACTION_BY_ID[p.faction].name} className="h-5 w-auto" /> : <span className="w-4" />}
                  <span className="flex-1 font-mono text-sm" title={p.wallet}>
                    {short(p.wallet)}
                  </span>
                  <span className="font-mono text-sm font-semibold">{p.renown.toLocaleString("en-US", { maximumFractionDigits: p.renown < 100 ? 2 : 0 })}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section aria-label="Great moments">
        <h4 className="font-display text-sm font-bold tracking-[0.2em]">GREAT MOMENTS</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Moment title="The most disputed field">
            {m.most_disputed ? (
              <>
                <b>{cellLabel(cellId(m.most_disputed.x, m.most_disputed.y))}</b> changed hands{" "}
                <b>{m.most_disputed.flips}</b> times
                {m.most_disputed.owner ? <> and fell to {FACTION_BY_ID[m.most_disputed.owner].name}</> : <> and lay empty at the knell</>}.
              </>
            ) : (
              "No field ever changed hands."
            )}
          </Moment>
          <Moment title="The greatest host">
            {m.biggest_army ? (
              <>
                <b>{n(m.biggest_army.force)}</b> strong, {FACTION_BY_ID[m.biggest_army.faction]?.name ?? "a Banner"} stood on{" "}
                <b>{cellLabel(cellId(m.biggest_army.x, m.biggest_army.y))}</b> when the knell rang.
              </>
            ) : (
              "No army stood on the field at the knell."
            )}
          </Moment>
          <Moment title="The Plague">
            {m.plague ? (
              <>
                It struck {cellLabel(cellId(m.plague.x, m.plague.y))} and around: <b>{m.plague.cells}</b> held field
                {m.plague.cells === 1 ? "" : "s"} turned to dust, <b>{n(m.plague.force)}</b> soldiers sent home.
              </>
            ) : (
              "The Plague never came this season."
            )}
          </Moment>
        </div>
      </section>

      <section aria-label="Share" className="flex flex-wrap items-center justify-center gap-2 border-t border-ink/25 pt-5">
        <a
          href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-parchment hover:bg-ink/85"
        >
          Share on X ↗
        </a>
        <button
          onClick={() => void navigator.clipboard?.writeText(url).then(() => setCopied(true))}
          className="rounded-md border border-ink/60 px-4 py-2 text-sm font-semibold hover:bg-ink/10"
        >
          {copied ? "Link copied" : "Copy link"}
        </button>
        <a href={`/archive/${page.number}/opengraph-image`} target="_blank" rel="noopener noreferrer" className="rounded-md border border-ink/60 px-4 py-2 text-sm font-semibold hover:bg-ink/10">
          The image ↗
        </a>
      </section>
    </div>
  );
}

function Moment({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[3px] border border-ink/35 bg-[#efe3c6]/35 p-3 font-fell text-[15px] leading-snug">
      <div className="mb-1 font-display text-xs font-bold tracking-[0.15em]">{title.toUpperCase()}</div>
      {children}
    </div>
  );
}
