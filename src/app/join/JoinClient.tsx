"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FACTION_CAP_PCT } from "@config/game";
import { FACTIONS, FACTION_BY_ID, type FactionId } from "@/lib/factions";
import type { BannerStatus } from "@/lib/game/types";
import { useSession } from "@/components/wallet/SessionProvider";
import { useWalletModal } from "@/components/wallet/WalletModal";
import { RecruitNotice } from "@/components/map/SidePanel";
import { Lore } from "@/components/Ornaments";

const fmt = (n: number) => n.toLocaleString("en-US");

export default function JoinClient() {
  const router = useRouter();
  const { status, me, refresh } = useSession();
  const { open } = useWalletModal();
  const [banners, setBanners] = useState<Record<string, BannerStatus>>({});
  const [confirm, setConfirm] = useState<FactionId | null>(null);
  const [pending, setPending] = useState<FactionId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/factions", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: BannerStatus[]) => setBanners(Object.fromEntries(list.map((b) => [b.faction, b]))))
      .catch(() => {});
  }, []);

  const signedIn = status === "signed-in" && me;
  const current = signedIn ? me.faction : null;
  const canSwitch = !current || (me?.switchesLeft ?? 0) > 0;

  const swear = async (f: FactionId) => {
    setPending(f);
    setError(null);
    try {
      const r = await fetch("/api/faction/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ factionId: f }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.message ?? "The oath could not be sworn. Try again.");
      await refresh();
      router.push("/map");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
      setConfirm(null);
    }
  };

  const onPick = (f: FactionId) => {
    if (!signedIn) return open();
    if (f === current) return router.push("/map");
    if (current) setConfirm(f);
    else void swear(f);
  };

  return (
    <div>
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold tracking-[0.2em] text-gold md:text-3xl">CHOOSE YOUR BANNER</h1>
        <Lore className="mx-auto mt-3 max-w-xl text-left text-[17px]">
          Five Banners hang in the hall. Swear your oath to one, and march under it until the Knell.
        </Lore>
        {!signedIn && status !== "loading" && (
          <button onClick={open} className="mt-5 rounded-md bg-gold px-5 py-2 text-sm font-semibold text-charcoal hover:brightness-110">
            Connect wallet to swear
          </button>
        )}
        {signedIn && me.soldiers === 0 && (
          <div className="mx-auto mt-5 max-w-sm text-left">
            <RecruitNotice />
            <p className="mt-1 text-center text-xs text-parchment/45">You can still choose a Banner now.</p>
          </div>
        )}
        {signedIn && current && (
          <p className="mt-4 text-sm text-parchment/60">
            You march with <span className="text-gold">{FACTION_BY_ID[current].name}</span>.{" "}
            {me.switchesLeft > 0 ? "You may change Banner once this season." : "You have no change of Banner left this season."}
          </p>
        )}
        {error && <p className="mt-4 text-sm text-[#e7b4a8]">{error}</p>}
      </div>

      {/* the five Banners, hanging side by side */}
      <div className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 md:justify-center md:gap-6 md:overflow-visible">
        {FACTIONS.map((f, i) => {
          const b = banners[f.id];
          const closed = b?.closed && f.id !== current;
          const mine = f.id === current;
          const disabled = !!pending || (!!signedIn && !mine && (!!closed || !canSwitch));
          return (
            <div key={f.id} className="flex w-[150px] shrink-0 snap-center flex-col items-center md:w-[170px]">
              <div className="h-[3px] w-[110%] rounded-full bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
              <button
                onClick={() => onPick(f.id)}
                disabled={disabled}
                className={`banner-sway group relative mt-0 transition ${closed ? "opacity-45 grayscale" : ""} ${
                  mine ? "drop-shadow-[0_0_18px_rgba(201,162,75,0.55)]" : "hover:-translate-y-1"
                } disabled:cursor-not-allowed`}
                style={{ animationDelay: `${-i * 1.1}s` }}
                aria-label={`${f.name}: ${f.motto}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.banner} alt={f.name} draggable={false} className="h-[420px] w-auto md:h-[480px]" />
                {closed && (
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded border-2 border-blood bg-charcoal/80 px-2 py-0.5 font-display text-sm tracking-[0.2em] text-[#e7b4a8]">
                    CLOSED
                  </span>
                )}
              </button>
              <h2 className="mt-3 text-center font-display text-sm tracking-[0.15em] text-parchment">{f.name.toUpperCase()}</h2>
              <dl className="mt-2 grid w-full grid-cols-2 gap-x-2 text-xs">
                <dt className="text-parchment/50">Members</dt>
                <dd className="text-right font-mono text-parchment/90">{b ? fmt(b.members) : "—"}</dd>
                <dt className="text-parchment/50">Force</dt>
                <dd className="text-right font-mono text-parchment/90">{b ? fmt(b.force) : "—"}</dd>
                <dt className="text-parchment/50">Share</dt>
                <dd className={`text-right font-mono ${closed ? "text-[#e7b4a8]" : "text-parchment/90"}`}>
                  {b ? `${b.sharePct}%` : "—"}
                </dd>
              </dl>
              <button
                onClick={() => onPick(f.id)}
                disabled={disabled}
                className={`mt-3 w-full rounded-md py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  mine ? "border border-gold text-gold" : "bg-gold text-charcoal hover:brightness-110"
                }`}
              >
                {pending === f.id
                  ? "Swearing…"
                  : mine
                    ? "Your Banner"
                    : closed
                      ? "Closed"
                      : !signedIn
                        ? "Swear the oath"
                        : current
                          ? canSwitch
                            ? "Change to this"
                            : "Locked"
                          : "Swear the oath"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-parchment/40">
        A Banner holding more than {FACTION_CAP_PCT}% of the realm&apos;s force is closed to newcomers until it falls back
        below.
      </p>

      {confirm && current && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4" onClick={() => setConfirm(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-lg border border-gold/50 bg-[#191613] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display tracking-[0.15em] text-gold">BREAK YOUR OATH?</h3>
            <p className="mt-2 text-sm text-parchment/75">
              You will leave {FACTION_BY_ID[current].name} for {FACTION_BY_ID[confirm].name}. All your soldiers return to
              reserve, and you cannot change Banner again this season.
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirm(null)} className="flex-1 rounded-md border border-gold/40 py-2 text-sm text-parchment/80">
                Stay
              </button>
              <button
                onClick={() => swear(confirm)}
                disabled={!!pending}
                className="flex-1 rounded-md bg-blood py-2 text-sm font-semibold text-parchment hover:brightness-110 disabled:opacity-50"
              >
                {pending ? "…" : "Change Banner"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
