"use client";

import Link from "next/link";
import { TOKEN_DECIMALS, VETERAN_MAX_DAYS } from "@config/game";
import { FACTION_BY_ID } from "@/lib/factions";
import { useSession } from "@/components/wallet/SessionProvider";
import { useWalletModal } from "@/components/wallet/WalletModal";
import { RecruitNotice } from "@/components/map/SidePanel";
import { Lore } from "@/components/Ornaments";

const fmt = (n: number) => n.toLocaleString("en-US");

function tokens(raw: string) {
  const r = BigInt(raw || "0");
  const unit = BigInt(10) ** BigInt(TOKEN_DECIMALS);
  return Number(r / unit).toLocaleString("en-US");
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-gold/20 bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-parchment/50">{label}</div>
      <div className="mt-0.5 font-mono text-xl text-parchment">{value}</div>
      {hint && <div className="text-[11px] text-parchment/45">{hint}</div>}
    </div>
  );
}

export default function MeClient() {
  const { status, me } = useSession();
  const { open } = useWalletModal();

  if (status === "loading") return <p className="text-center font-fell italic text-parchment/60">Fetching your shield…</p>;
  if (status !== "signed-in" || !me) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-display text-2xl tracking-[0.2em] text-gold">MY SHIELD</h1>
        <p className="mt-2 text-parchment/70">Connect your wallet to see your army.</p>
        <button onClick={open} className="mt-5 rounded-md bg-gold px-5 py-2 text-sm font-semibold text-charcoal hover:brightness-110">
          Connect wallet
        </button>
      </div>
    );
  }

  const f = me.faction ? FACTION_BY_ID[me.faction] : null;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        {f ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.crest} alt={f.name} className="h-28 w-auto drop-shadow-[0_6px_12px_rgba(0,0,0,0.6)]" />
        ) : (
          <div className="grid h-28 w-24 place-items-center rounded-b-[40%] border-2 border-dashed border-gold/40 font-display text-gold/50">
            ?
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl tracking-[0.2em] text-gold">MY SHIELD</h1>
          <p className="mt-1 break-all font-mono text-sm text-parchment/70">{me.wallet}</p>
          {f ? (
            <p className="mt-1 font-fell text-lg italic text-parchment/85">
              Sworn to {f.name} · “{f.motto}”
            </p>
          ) : (
            <Link href="/join" className="mt-2 inline-block rounded-md bg-gold px-4 py-1.5 text-sm font-semibold text-charcoal">
              Choose a Banner
            </Link>
          )}
          {me.excluded && <p className="mt-2 text-sm text-[#e7b4a8]">This wallet is excluded from the war (rule 10).</p>}
        </div>
      </div>

      {me.soldiers === 0 && (
        <div className="mx-auto mt-6 max-w-md">
          <RecruitNotice />
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="$WERGILD held" value={tokens(me.balance)} />
        <Stat label="Soldiers" value={fmt(me.soldiers)} hint="1 per 1,000 $WERGILD" />
        <Stat label="Force" value={fmt(me.force)} hint={`soldiers × ${me.veteranMultiplier.toFixed(2)}`} />
        <Stat label="Seniority" value={`${me.ageDays} d`} hint={`×2 at ${VETERAN_MAX_DAYS} days`} />
        <Stat label="Veteran bonus" value={`+${Math.round((me.veteranMultiplier - 1) * 100)}%`} />
        <Stat label="Reserve" value={fmt(me.reserve)} hint={`${fmt(me.deployed)} deployed`} />
        <Stat label="Cells held" value={fmt(me.cellsHeld)} hint={`${me.deployments.length} cells with my soldiers`} />
        <Stat label="Renown" value={fmt(Math.round(me.renown))} hint="this season" />
        <Stat label="Banner changes left" value={String(me.switchesLeft)} hint="this season" />
      </div>

      <section className="mt-8">
        <h2 className="font-display text-sm tracking-[0.18em] text-gold">BADGES</h2>
        {me.badges.length === 0 ? (
          <Lore className="mt-3">No badge yet. The ten most renowned of each season are honoured for ever.</Lore>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {me.badges.map((b) => (
              <li key={b} className="rounded border border-gold/40 px-2 py-1 text-sm text-gold">
                {b}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 flex justify-center gap-3">
        <Link href="/map" className="rounded-md bg-gold px-5 py-2 text-sm font-semibold text-charcoal hover:brightness-110">
          To the map
        </Link>
      </div>
    </div>
  );
}
