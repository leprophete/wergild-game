/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import * as G from "@config/game";
import PageShell from "@/components/PageShell";
import { Divider, Lore } from "@/components/Ornaments";
import { Mark } from "@/components/Engravings";
import { WaxSeal } from "@/components/Seal";
import { FACTIONS } from "@/lib/factions";

export const metadata: Metadata = {
  title: "The Rules — $WERGILD",
  description: "The rules of the war of the five Banners, on one page, and the risks of holding $WERGILD.",
};

const n = (v: number) => v.toLocaleString("en-US");

function Rule({ no, title, art, children }: { no: number; title: string; art: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={`rule-${no}`} className="grid scroll-mt-20 grid-cols-[56px_1fr] gap-4 border-b border-gold/15 py-6 sm:grid-cols-[84px_1fr] sm:gap-6">
      <div className="flex flex-col items-center gap-2">
        <span className="font-display text-xs tracking-[0.2em] text-gold/70">RULE {no}</span>
        <div className="grid h-14 w-14 place-items-center rounded-full bg-[radial-gradient(circle,#efe3c6,#d9c79f)] p-1.5 shadow-[inset_0_0_8px_rgba(110,80,40,0.45)] sm:h-[72px] sm:w-[72px]">
          {art}
        </div>
      </div>
      <div>
        <h2 className="font-display text-lg tracking-[0.12em] text-gold">{title}</h2>
        <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-parchment/80 [&_b]:font-semibold [&_b]:text-parchment [&_code]:font-mono [&_code]:text-gold/90">
          {children}
        </div>
      </div>
    </section>
  );
}

export default function RulesPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">
        <header className="text-center">
          <h1 className="font-display text-2xl tracking-[0.2em] text-gold">THE RULES OF THE WAR</h1>
          <p className="mt-1 font-fell text-lg italic text-parchment/70">“Every token has a price in blood.”</p>
        </header>
        <Lore className="mt-6 text-[18px] lg:-mx-20">
          Hear ye: five Banners fight over one old map. Whoever holds $WERGILD holds soldiers; whoever holds the most land
          when the knell tolls is sung in the Chronicles. No dice are cast, no fortune is told: every outcome is reckoned
          by the same rules, on the server, for all.
        </Lore>

        <nav aria-label="Rules" className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
          {["Soldiers", "Seniority", "Banners", "Deployment", "Battles", "Selling", "Score", "Seasons", "Events", "Excluded"].map(
            (t, i) => (
              <a key={t} href={`#rule-${i + 1}`} className="rounded-full border border-gold/25 px-2.5 py-1 text-parchment/70 hover:border-gold/60 hover:text-parchment">
                {i + 1}. {t}
              </a>
            ),
          )}
          <a href="#risks" className="rounded-full border border-[#8E1B1B]/70 px-2.5 py-1 text-[#e7b4a8] hover:border-[#c0392b]">
            Risks
          </a>
        </nav>

        <div className="mt-4">
          <Rule no={1} title="SOLDIERS" art={<Mark kind="coins" className="h-full w-full" />}>
            <p>
              You hold <b>1 soldier for every {n(G.TOKENS_PER_SOLDIER)} $WERGILD</b> in your wallet. The count is linear:
              splitting tokens over several wallets gains nothing. Under {n(G.TOKENS_PER_SOLDIER)} tokens, you have no
              soldier yet.
            </p>
            <p>Your balance is read on-chain by the server. Nothing to stake, nothing to send: your wallet is your army.</p>
          </Rule>

          <Rule no={2} title="SENIORITY & VETERANS" art={<Mark kind="hourglass" className="h-full w-full" />}>
            <p>
              <b>Force = soldiers × (1 + min(days held, {G.VETERAN_MAX_DAYS}) / {G.VETERAN_MAX_DAYS})</b>. A soldier is
              worth ×1 the day it is bought and ×2 after {G.VETERAN_MAX_DAYS} days.
            </p>
            <p>
              Buying more dilutes your seniority (a weighted average). Selling does not change it, but the soldiers sold are
              gone. Tokens received from another wallet count as a purchase: moving tokens loses the veteran bonus.
            </p>
          </Rule>

          <Rule no={3} title="THE BANNERS" art={<img src={FACTIONS[0].crest} alt="" className="h-full w-auto" />}>
            <div className="flex flex-wrap gap-3 pb-1">
              {FACTIONS.map((f) => (
                <span key={f.id} className="flex items-center gap-1.5 text-sm">
                  <img src={f.crest} alt="" className="h-6 w-auto" />
                  {f.name}
                </span>
              ))}
            </div>
            <p>
              On your first visit you swear to one of the {G.FACTION_COUNT} Banners. You may change Banner{" "}
              <b>{G.FACTION_SWITCHES_PER_SEASON} time per season</b>; all your soldiers then return to reserve.
            </p>
            <p>
              A Banner holding more than <b>{G.FACTION_CAP_PCT} %</b> of the total force of all sworn players is closed to
              newcomers until it falls back under that line.
            </p>
          </Rule>

          <Rule no={4} title="DEPLOYMENT" art={<Mark kind="pawn" className="h-full w-full" />}>
            <p>
              Spread your force over the cells of the map; what you do not deploy stays in <b>reserve</b>. You may deploy on
              a neutral or enemy cell only if it <b>touches, by a side, a cell your Banner holds</b>. Water cannot be held;
              the four bridges are the only ways onto Knave&apos;s Hollow.
            </p>
            <p>
              Each Banner starts the season with a <b>2 × 2 base camp</b> in its homeland. It is impregnable: it belongs to
              its Banner all season, only its members may deploy there, and it scores <b>no point</b>.
            </p>
            <p>
              At most <b>{n(G.MAX_FORCE_PER_CELL)} force per player on one cell</b>. Soldiers just deployed or moved are held
              by <b>wet ink for {G.COOLDOWN_MINUTES} minutes</b> before they can leave.
            </p>
          </Rule>

          <Rule no={5} title="CONTROL & BATTLES" art={<Mark kind="swords" className="h-full w-full" />}>
            <p>
              A cell belongs to the Banner with the <b>greatest total force</b> on it, all its members added up. On a tie, the
              holder keeps it. Attacking is simply deploying more force than the defender; the outcome is immediate.
            </p>
            <p>
              Beaten soldiers do not die: they stay and may retake the cell with reinforcements. Crossed swords mark the cells
              where the top two Banners stand within {G.CONTESTED_GAP_PCT} %.
            </p>
          </Rule>

          <Rule
            no={6}
            title="SELLING"
            art={
              <svg viewBox="0 0 60 60" className="h-full w-full" aria-hidden>
                <path d="M14 46 C 24 34, 34 30, 46 14" fill="none" stroke="#2A1F14" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M18 18 h10 M18 26 h16 M18 34 h8" stroke="#2A1F14" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
              </svg>
            }
          >
            <p>
              When your balance falls below what you have deployed, soldiers are struck off: <b>the reserve goes first</b>,
              then the same share everywhere you stand. Sell, and your land fades.
            </p>
          </Rule>

          <Rule no={7} title="SCORE & RENOWN" art={<Mark kind="tower" className="h-full w-full" />}>
            <p>
              At every <b>full hour (UTC)</b>, each Banner scores <b>{G.CELL_POINTS} point per cell</b> it holds and{" "}
              <b>{G.BONUS_CELL_POINTS} per watchtower</b>.
            </p>
            <p>
              The hour is reckoned on each player&apos;s <b>lowest force during that hour</b>, and the owners are worked out
              again from those forces: buying just before the hour and selling just after brings nothing.
            </p>
            <p>
              <b>Renown</b>, your own score: a cell&apos;s points are shared among the members of the Banner holding it, in
              proportion to their force there.
            </p>
          </Rule>

          <Rule no={8} title="SEASONS & THE KNELL" art={<WaxSeal color="#8E1B1B" size={56} />}>
            <p>
              A season lasts <b>{G.SEASON_DAYS} days</b> and opens on a Monday at 17:00 UTC. The winner is the Banner with
              the most points <b>over the whole season</b>, not the leader of the last hour.
            </p>
            <p>
              At the knell the map is sealed in the Chronicles, then redrawn; every soldier returns to reserve.{" "}
              <b>Seniority is kept.</b> The winning Banner is embroidered in the Hall of Fame and names the next season&apos;s
              map; the ten most renowned players earn a permanent badge.
            </p>
          </Rule>

          <Rule
            no={9}
            title="EVENTS"
            art={
              <svg viewBox="0 0 60 60" className="h-full w-full" aria-hidden>
                <rect x="12" y="12" width="36" height="36" fill="rgba(201,162,75,0.25)" stroke="#C9A24B" strokeWidth="2.4" strokeDasharray="6 3" />
                <text x="30" y="35" textAnchor="middle" fontSize="13" fill="#2A1F14" fontFamily="var(--nf-cinzel), serif">
                  ×3
                </text>
              </svg>
            }
          >
            <p>
              Events are set by the heralds and announced on the map <b>at least {G.EVENT_NOTICE_HOURS} hours ahead</b>.
            </p>
            <ul className="space-y-1.5">
              <li>
                <b>The Tithe</b>: a {G.TITHE_SIZE} × {G.TITHE_SIZE} zone is worth ×{G.TITHE_MULTIPLIER} points for{" "}
                {G.TITHE_HOURS} hours. Once a day.
              </li>
              <li>
                <b>The Plague</b>: a {G.PLAGUE_SIZE} × {G.PLAGUE_SIZE} zone turns neutral; the soldiers in it return to
                reserve. Once a season.
              </li>
              <li>
                <b>The Rush</b>: no wet ink for {G.RUSH_HOURS} hour. Once a week.
              </li>
            </ul>
          </Rule>

          <Rule
            no={10}
            title="EXCLUDED WALLETS"
            art={
              <svg viewBox="0 0 60 60" className="h-full w-full" aria-hidden>
                <circle cx="30" cy="30" r="18" fill="none" stroke="#8E1B1B" strokeWidth="2.4" />
                <path d="M17 43 L43 17" stroke="#8E1B1B" strokeWidth="2.4" />
              </svg>
            }
          >
            <p>
              The liquidity pool, the pump.fun bonding curve, the developer&apos;s wallet and known exchange addresses cannot
              play.
            </p>
            <p>
              Developer&apos;s wallet:{" "}
              {G.DEV_WALLET ? (
                <code className="break-all">{G.DEV_WALLET}</code>
              ) : (
                <span className="italic text-parchment/60">published here at launch.</span>
              )}
            </p>
          </Rule>
        </div>

        <Divider className="mt-8" />

        <section id="risks" className="scroll-mt-20 rounded-md border-2 border-[#8E1B1B]/80 bg-[#2a1414]/60 p-5 sm:p-6">
          <h2 className="font-display text-lg tracking-[0.14em] text-[#e7b4a8]">THE RISKS — READ BEFORE YOU BUY</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-parchment/85">
            <li>
              <b>$WERGILD is a memecoin. It has no guaranteed value.</b> Its price can fall to zero.{" "}
              <b>You can lose everything you put in.</b>
            </li>
            <li>It is not an investment and nothing here promises a rise in price, a return or any income.</li>
            <li>
              The game gives <b>no money and no token reward</b>: only glory, the Hall of Fame and badges.
            </li>
            <li>
              Crypto-assets are volatile and largely unregulated. Rules on them, and on games, differ from one country to
              another: make sure you are allowed to take part where you live.
            </li>
            <li>Nothing on this site is financial, legal or tax advice. Only spend what you can afford to lose.</li>
            <li>
              The game reads public wallet balances. It never asks for your seed phrase or a transaction to play: signing in
              is a free message.
            </li>
          </ul>
        </section>

        <div className="mt-10 flex justify-center gap-3">
          <Link href="/map" className="rounded-md bg-gold px-5 py-2 text-sm font-semibold text-charcoal hover:brightness-110">
            To the map
          </Link>
          <Link href="/join" className="rounded-md border border-gold/50 px-5 py-2 text-sm font-semibold text-gold hover:bg-gold/10">
            Choose a Banner
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
