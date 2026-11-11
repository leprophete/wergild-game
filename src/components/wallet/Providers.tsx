"use client";

import { useCallback, useMemo } from "react";
import type { WalletError } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { clusterApiUrl } from "@solana/web3.js";
import { SOLANA_CLUSTER } from "@config/game";
import { SessionProvider } from "./SessionProvider";
import { WalletModalProvider } from "./WalletModal";

/**
 * Phantom, Solflare and Backpack all implement the Wallet Standard, so the adapter
 * discovers them by itself: no wallet-specific package needed.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl(SOLANA_CLUSTER), []);
  // The adapter's default handler uses console.error for ordinary events (wallet locked,
  // request declined, auto-connect to a wallet that is not installed). Those are not bugs.
  const onError = useCallback((error: WalletError) => {
    console.warn(`wallet: ${error.name}${error.message ? ` — ${error.message}` : ""}`);
  }, []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect onError={onError}>
        <SessionProvider>
          <WalletModalProvider>{children}</WalletModalProvider>
        </SessionProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
