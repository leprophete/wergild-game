"use client";

import { useMemo } from "react";
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
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <SessionProvider>
          <WalletModalProvider>{children}</WalletModalProvider>
        </SessionProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
