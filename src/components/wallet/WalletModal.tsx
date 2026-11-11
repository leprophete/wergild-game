"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { useSession } from "./SessionProvider";

/** The three wallets of the spec, shown even when not installed (with an install link). */
const KNOWN = [
  { name: "Phantom", url: "https://phantom.app/download" },
  { name: "Solflare", url: "https://solflare.com/download" },
  { name: "Backpack", url: "https://backpack.app/downloads" },
];

const ModalContext = createContext<{ open: () => void } | null>(null);
export const useWalletModal = () => {
  const v = useContext(ModalContext);
  if (!v) throw new Error("useWalletModal outside WalletModalProvider");
  return v;
};

export function WalletModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  return (
    <ModalContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      {isOpen && <WalletModal onClose={() => setOpen(false)} />}
    </ModalContext.Provider>
  );
}

function WalletModal({ onClose }: { onClose: () => void }) {
  const { wallets, select, connected, publicKey } = useWallet();
  const { armAutoSignIn, signIn, busy, error, status, me } = useSession();
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // close once signed in with the connected wallet
  useEffect(() => {
    if (status === "signed-in" && publicKey && me?.wallet === publicKey.toBase58() && picked) onClose();
  }, [status, me, publicKey, picked, onClose]);

  const detected = wallets.filter(
    (w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable,
  );
  const names = new Set(detected.map((w) => w.adapter.name));
  const missing = KNOWN.filter((k) => !names.has(k.name as WalletName));

  const pick = (name: WalletName) => {
    setPicked(name);
    armAutoSignIn();
    select(name);
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-title"
        className="relative w-full max-w-sm rounded-lg border border-gold/50 bg-[#191613] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-1.5 rounded-md border border-gold/20" />
        <button onClick={onClose} className="absolute right-3 top-2 text-parchment/60 hover:text-parchment" aria-label="Close">
          ✕
        </button>
        <h2 id="wallet-title" className="font-display text-base font-semibold tracking-[0.18em] text-gold">
          RAISE YOUR BANNER
        </h2>
        <p className="mt-1 text-sm text-parchment/65">
          Connect a Solana wallet, then sign a free message to prove it is yours. No transaction, no fee.
        </p>

        <ul className="mt-4 space-y-2">
          {detected.map((w) => (
            <li key={w.adapter.name}>
              <button
                onClick={() => pick(w.adapter.name)}
                disabled={busy}
                className="flex w-full items-center gap-3 rounded-md border border-gold/30 bg-white/[0.03] px-3 py-2.5 text-left text-sm text-parchment transition hover:border-gold hover:bg-gold/10 disabled:opacity-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.adapter.icon} alt="" className="h-7 w-7 rounded" />
                <span className="flex-1 font-medium">{w.adapter.name}</span>
                <span className="text-[11px] text-gold/80">
                  {picked === w.adapter.name && (busy ? "Sign in your wallet…" : connected ? "Connected" : "Opening…")}
                  {picked !== w.adapter.name && "Detected"}
                </span>
              </button>
            </li>
          ))}
          {missing.map((k) => (
            <li key={k.name}>
              <a
                href={k.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-3 rounded-md border border-white/10 px-3 py-2.5 text-sm text-parchment/55 transition hover:border-gold/40 hover:text-parchment"
              >
                <span className="grid h-7 w-7 place-items-center rounded bg-white/5 font-display text-xs">{k.name[0]}</span>
                <span className="flex-1">{k.name}</span>
                <span className="text-[11px]">Install ↗</span>
              </a>
            </li>
          ))}
        </ul>

        {connected && !busy && status !== "signed-in" && picked && (
          <button
            onClick={() => signIn()}
            className="mt-4 w-full rounded-md bg-gold py-2 text-sm font-semibold text-charcoal hover:brightness-110"
          >
            Sign the oath
          </button>
        )}
        {error && <p className="mt-3 text-sm text-[#e7b4a8]">{error}</p>}
        <p className="mt-4 text-[11px] leading-relaxed text-parchment/40">
          On a phone, open this site inside your wallet&apos;s browser (Phantom, Solflare or Backpack).
        </p>
      </div>
    </div>
  );
}
