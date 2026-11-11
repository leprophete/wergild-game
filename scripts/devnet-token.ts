/**
 * DEVNET ONLY — a stand-in $WERGILD to test the game before launch.
 * Devnet tokens have no value. This script refuses to talk to mainnet.
 *
 *   npm run devnet -- create                 create the test mint (1 000 000 000 tokens, 6 decimals)
 *   npm run devnet -- send <wallet> <amount> send test tokens to a wallet (amount in whole tokens)
 *   npm run devnet -- balance <wallet>       show a wallet's test-token balance
 *
 * The mint authority keypair is stored in .devnet/ (git-ignored).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, transfer } from "@solana/spl-token";

const RPC = process.env.DEVNET_RPC_URL ?? "https://api.devnet.solana.com";
if (!/devnet/.test(RPC)) throw new Error("This script only runs against devnet.");
const DECIMALS = 6;
const SUPPLY = BigInt(1_000_000_000) * BigInt(10 ** DECIMALS);
const DIR = join(process.cwd(), ".devnet");
const AUTH = join(DIR, "mint-authority.json");
const MINT = join(DIR, "mint.txt");

const conn = new Connection(RPC, "confirmed");

function authority(): Keypair {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  if (!existsSync(AUTH)) writeFileSync(AUTH, JSON.stringify(Array.from(Keypair.generate().secretKey)), { mode: 0o600 });
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(AUTH, "utf8"))));
}

async function ensureSol(kp: Keypair) {
  const bal = await conn.getBalance(kp.publicKey);
  if (bal >= 0.05 * LAMPORTS_PER_SOL) return;
  console.log(`Requesting a devnet airdrop for ${kp.publicKey.toBase58()}…`);
  try {
    const sig = await conn.requestAirdrop(kp.publicKey, 1 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
  } catch {
    console.error(
      `\nThe devnet faucet refused (it is often rate-limited).\n` +
        `Get free devnet SOL for this address at https://faucet.solana.com (choose Devnet):\n\n  ${kp.publicKey.toBase58()}\n\nthen run the command again.`,
    );
    process.exit(2);
  }
}

async function create() {
  if (existsSync(MINT)) {
    console.log(`Test mint already exists: ${readFileSync(MINT, "utf8").trim()}`);
    return;
  }
  const kp = authority();
  await ensureSol(kp);
  const mint = await createMint(conn, kp, kp.publicKey, null, DECIMALS);
  const ata = await getOrCreateAssociatedTokenAccount(conn, kp, mint, kp.publicKey);
  await mintTo(conn, kp, mint, ata.address, kp, SUPPLY);
  writeFileSync(MINT, mint.toBase58());
  console.log(`\nTest $WERGILD created on devnet.\nMINT=${mint.toBase58()}\n`);
}

async function send(to: string, amount: number) {
  if (!existsSync(MINT)) throw new Error("Run `npm run devnet -- create` first.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount must be a positive number of tokens");
  const kp = authority();
  await ensureSol(kp);
  const mint = new PublicKey(readFileSync(MINT, "utf8").trim());
  const dest = new PublicKey(to);
  const from = await getOrCreateAssociatedTokenAccount(conn, kp, mint, kp.publicKey);
  const toAta = await getOrCreateAssociatedTokenAccount(conn, kp, mint, dest);
  const raw = BigInt(Math.round(amount * 10 ** DECIMALS));
  const sig = await transfer(conn, kp, from.address, toAta.address, kp, raw);
  console.log(`Sent ${amount.toLocaleString("en-US")} test $WERGILD to ${to}\nhttps://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

async function balance(of: string) {
  const mint = new PublicKey(readFileSync(MINT, "utf8").trim());
  const res = await conn.getParsedTokenAccountsByOwner(new PublicKey(of), { mint });
  const total = res.value.reduce((s, a) => s + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
  console.log(`${of}: ${total.toLocaleString("en-US")} test $WERGILD`);
}

const [cmd, a, b] = process.argv.slice(2);
const run = cmd === "create" ? create() : cmd === "send" ? send(a, Number(b)) : cmd === "balance" ? balance(a) : null;
if (!run) {
  console.log("usage: npm run devnet -- create | send <wallet> <amount> | balance <wallet>");
  process.exit(1);
}
run.catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
