"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { MeResponse } from "@/lib/game/types";

type Status = "loading" | "signed-out" | "signed-in";

interface SessionValue {
  status: Status;
  me: MeResponse | null;
  /** a sign-in is waiting for the wallet signature */
  busy: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Ask the connected wallet to sign the free sign-in message. */
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
  /** call before connecting: sign in automatically once the wallet is connected */
  armAutoSignIn: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession() {
  const v = useContext(SessionContext);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

const ERRORS: Record<string, string> = {
  nonce_invalid_or_expired: "The seal expired. Please sign again.",
  bad_signature: "The signature did not match this wallet.",
  unknown_domain: "Sign-in is not allowed from this address.",
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSignIn = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      if (r.ok) {
        setMe(await r.json());
        setStatus("signed-in");
      } else {
        setMe(null);
        setStatus("signed-out");
      }
    } catch {
      setStatus((s) => (s === "loading" ? "signed-out" : s));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError("This wallet cannot sign messages.");
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const wallet = publicKey.toBase58();
      const n = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      if (!n.ok) throw new Error((await n.json()).error ?? "nonce_failed");
      const { nonce, message } = (await n.json()) as { nonce: string; message: string };
      const signature = await signMessage(new TextEncoder().encode(message));
      const v = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet, nonce, signature: toBase64(signature) }),
      });
      if (!v.ok) throw new Error((await v.json()).error ?? "verify_failed");
      await refresh();
      return true;
    } catch (e) {
      const code = e instanceof Error ? e.message : String(e);
      setError(/reject|denied|cancel/i.test(code) ? "Signature declined." : (ERRORS[code] ?? "Sign-in failed. Try again."));
      return false;
    } finally {
      setBusy(false);
    }
  }, [publicKey, signMessage, refresh]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    setStatus("signed-out");
    autoSignIn.current = false;
    await disconnect().catch(() => {});
  }, [disconnect]);

  // After the player picked a wallet in our modal, sign in as soon as it is connected.
  useEffect(() => {
    if (!connected || !publicKey || !autoSignIn.current || busy) return;
    if (status === "signed-in" && me?.wallet === publicKey.toBase58()) {
      autoSignIn.current = false;
      return;
    }
    autoSignIn.current = false;
    void signIn();
  }, [connected, publicKey, status, me, busy, signIn]);

  const armAutoSignIn = useCallback(() => {
    autoSignIn.current = true;
    setError(null);
  }, []);

  return (
    <SessionContext.Provider value={{ status, me, busy, error, refresh, signIn, signOut, armAutoSignIn }}>
      {children}
    </SessionContext.Provider>
  );
}
