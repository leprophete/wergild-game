import "server-only";
import { SOLANA_CLUSTER, TOKEN_MINT } from "@config/game";

/**
 * Reads a wallet's $WERGILD balance straight from a Solana RPC node.
 * This is the ONLY source of balances: webhook bodies are never trusted.
 * Works for both SPL Token and Token-2022 mints (the RPC resolves the program from the mint).
 */

export function rpcUrl(): string {
  if (process.env.SOLANA_RPC_URL) return process.env.SOLANA_RPC_URL;
  const key = process.env.HELIUS_API_KEY;
  const net = SOLANA_CLUSTER === "mainnet-beta" ? "mainnet" : "devnet";
  if (key) return `https://${net}.helius-rpc.com/?api-key=${key}`;
  return SOLANA_CLUSTER === "mainnet-beta" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com";
}

export const tokenMint = () => process.env.NEXT_PUBLIC_TOKEN_MINT || TOKEN_MINT;

interface TokenAccountsResult {
  value: { account: { data: { parsed: { info: { mint: string; tokenAmount: { amount: string } } } } } }[];
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`rpc_http_${res.status}`);
  const body = (await res.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(`rpc_error: ${body.error.message}`);
  return body.result as T;
}

/** Raw balance in base units (sum of every token account of this wallet for the mint). */
export async function fetchTokenBalance(wallet: string): Promise<bigint> {
  const mint = tokenMint();
  if (!mint) return BigInt(0); // no token yet (before launch): everyone has 0 soldiers
  const result = await rpc<TokenAccountsResult>("getTokenAccountsByOwner", [
    wallet,
    { mint },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  let total = BigInt(0);
  for (const acc of result.value) {
    const info = acc.account.data.parsed.info;
    if (info.mint === mint) total += BigInt(info.tokenAmount.amount);
  }
  return total;
}
