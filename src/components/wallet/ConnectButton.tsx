"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FACTION_BY_ID } from "@/lib/factions";
import { useSession } from "./SessionProvider";
import { useWalletModal } from "./WalletModal";

export const shortWallet = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;

/** Header button: "Connect wallet" or the signed-in wallet with a small menu. */
export function ConnectButton({ className = "" }: { className?: string }) {
  const { status, me, signOut } = useSession();
  const { open } = useWalletModal();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  if (status === "loading") return <div className={`h-8 w-28 animate-pulse rounded-md bg-white/5 ${className}`} />;

  if (status !== "signed-in" || !me) {
    return (
      <button
        onClick={open}
        className={`rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-charcoal transition hover:brightness-110 md:text-sm ${className}`}
      >
        Connect wallet
      </button>
    );
  }

  const f = me.faction ? FACTION_BY_ID[me.faction] : null;
  return (
    <div className={className}>
      <div ref={ref} className="relative">
      <button
        onClick={() => setMenu((m) => !m)}
        className="flex items-center gap-2 rounded-md border border-gold/40 bg-white/[0.03] px-2 py-1 text-xs text-parchment hover:border-gold md:text-sm"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {f && <img src={f.crest} alt="" className="h-5 w-auto" />}
        <span className="font-mono">{shortWallet(me.wallet)}</span>
      </button>
      {menu && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md border border-gold/40 bg-[#191613] text-sm shadow-xl">
          <Link href="/me" className="block px-3 py-2 text-parchment/85 hover:bg-gold/10" onClick={() => setMenu(false)}>
            My Shield
          </Link>
          <Link href="/join" className="block px-3 py-2 text-parchment/85 hover:bg-gold/10" onClick={() => setMenu(false)}>
            {me.faction ? "My Banner" : "Choose a Banner"}
          </Link>
          <button onClick={() => signOut()} className="block w-full px-3 py-2 text-left text-parchment/60 hover:bg-gold/10">
            Disconnect
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
