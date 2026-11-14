// War Council API test, against a running server (npm run dev) and its database.
//   node tests/chat-api.mjs [base url, default http://localhost:3000]
// Reads .env.local (SESSION_SECRET to sign test sessions, SUPABASE_SECRET_KEY to create and
// remove throwaway players). Everything it creates is deleted at the end.
import fs from "node:fs";
import { createHmac, randomBytes } from "node:crypto";
import { createRequire } from "node:module";

const bs58 = createRequire(import.meta.url)("bs58");
const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const BASE = process.argv[2] ?? "http://localhost:3000";
const DB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY;
const ADMIN = (env.ADMIN_WALLETS ?? "").split(",")[0].trim();

const wallet = () => (bs58.default ?? bs58).encode(randomBytes(32));
const A = wallet(); // Goblins
const A2 = wallet(); // Goblins
const K = wallet(); // Knaves
const V = wallet(); // no Banner
const mint = (w) => {
  const p = `${w}.${Date.now() + 3600e3}`;
  return `wg_session=${p}.${createHmac("sha256", env.SESSION_SECRET).update(p).digest("base64url")}`;
};

const db = (method, path, body) =>
  fetch(`${DB}/rest/v1/${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: body ? JSON.stringify(body) : undefined,
  });
const api = async (method, path, { as, body, headers = {} } = {}) => {
  const r = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(as ? { cookie: mint(as) } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: r.status, json, text };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
const check = (label, got, expect) => {
  const ok = got === expect;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label.padEnd(64)} ${got}${ok ? "" : ` (expect ${expect})`}`);
};

const players = [A, A2, K, V];
try {
  const ins = await db("POST", "players", [
    { wallet: A, faction_id: "goblins" },
    { wallet: A2, faction_id: "goblins" },
    { wallet: K, faction_id: "knaves" },
    { wallet: V, faction_id: null },
  ]);
  if (!ins.ok) throw new Error(`could not create test players: ${ins.status} ${await ins.text()}`);

  // 401: no session
  check("visitor GET /api/chat", (await api("GET", "/api/chat")).status, 401);
  check("visitor POST /api/chat", (await api("POST", "/api/chat", { body: { text: "hi" } })).status, 401);
  check("visitor POST /api/chat/report", (await api("POST", "/api/chat/report", { body: { id: 1 } })).status, 401);
  check("forged session cookie", (await api("GET", "/api/chat", { headers: { cookie: `wg_session=${A}.${Date.now() + 9e8}.AAAA` } })).status, 401);

  // a Goblin speaks
  const first = await api("POST", "/api/chat", { as: A, body: { text: "To the ford at dawn, Goblins." } });
  check("Goblin posts to the Goblin council", first.status, 201);
  const msgId = first.json.id;

  // 403: another Banner, or none
  check("Knave reads the Goblin council (?faction=goblins)", (await api("GET", "/api/chat?faction=goblins", { as: K })).status, 403);
  check("Knave writes to the Goblin council", (await api("POST", "/api/chat", { as: K, body: { text: "spy", faction: "goblins" } })).status, 403);
  const knaveView = await api("GET", "/api/chat", { as: K });
  check("Knave reads own council: 200", knaveView.status, 200);
  check("…and sees no Goblin message", knaveView.text.includes("ford at dawn"), false);
  check("sworn to no Banner: GET", (await api("GET", "/api/chat", { as: V })).status, 403);
  check("Knave reports a Goblin message", (await api("POST", "/api/chat/report", { as: K, body: { id: msgId } })).status, 403);

  // the Goblins read it, without the full wallet
  const view = await api("GET", "/api/chat?since=0", { as: A2 });
  const m = view.json.messages?.find((x) => x.id === msgId);
  check("Goblin reads the council", view.status, 200);
  check("author is the shortened wallet", m?.author, `${A.slice(0, 4)}…${A.slice(-4)}`);
  check("full wallet never sent", view.text.includes(A), false);
  check("grade given", typeof m?.grade, "string");
  check("since=<last id> returns nothing new", (await api("GET", `/api/chat?since=${msgId}`, { as: A2 })).json.messages?.length, 0);

  // 400: links, HTML, size, junk
  for (const [label, text] of [
    ["URL", "see https://evil.example"],
    ["bare domain", "buy at pump.fun"],
    ["telegram", "t.me/goblins"],
    ["disguised domain", "evil[.]com"],
    ["full-width domain", "ｅｖｉｌ．ｃｏｍ"],
  ])
    check(`message with a link (${label})`, (await api("POST", "/api/chat", { as: A2, body: { text } })).status, 400);
  check("message with HTML", (await api("POST", "/api/chat", { as: A2, body: { text: "<img src=x onerror=alert(1)>" } })).status, 400);
  check("281 characters", (await api("POST", "/api/chat", { as: A2, body: { text: "x".repeat(281) } })).status, 400);
  check("extra field (wallet)", (await api("POST", "/api/chat", { as: A2, body: { text: "hi", wallet: K } })).status, 400);
  check("bad since", (await api("GET", "/api/chat?since=1%20or%201=1", { as: A2 })).status, 400);
  check("unknown faction param", (await api("GET", "/api/chat?faction=pirates", { as: A2 })).status, 400);

  // 429: one message every 3 s, 20 a minute
  check("second message within 3 s", (await api("POST", "/api/chat", { as: A, body: { text: "again" } })).status, 429);
  await sleep(3200);
  await db("POST", "rate_limits?on_conflict=key", { key: `chat:min:${A}`, window_start: new Date().toISOString(), hits: 20 });
  await db("PATCH", `rate_limits?key=eq.${encodeURIComponent(`chat:min:${A}`)}`, { window_start: new Date().toISOString(), hits: 20 });
  const over = await api("POST", "/api/chat", { as: A, body: { text: "the 21st" } });
  check("21st message in a minute", over.status, 429);

  // cross-site
  check("cross-site POST (Origin evil)", (await api("POST", "/api/chat", { as: A2, body: { text: "csrf" }, headers: { origin: "https://evil.example" } })).status, 403);

  // reports and moderation
  check("Goblin reports a Goblin message", (await api("POST", "/api/chat/report", { as: A2, body: { id: msgId } })).status, 200);
  check("visitor GET /api/admin/chat", (await api("GET", "/api/admin/chat")).status, 401);
  check("player GET /api/admin/chat", (await api("GET", "/api/admin/chat", { as: A2 })).status, 403);
  check("player mutes someone", (await api("POST", "/api/admin/chat", { as: A2, body: { action: "mute", wallet: A, minutes: 60 } })).status, 403);
  if (ADMIN) {
    const list = await api("GET", "/api/admin/chat", { as: ADMIN });
    check("admin sees the reported message", !!list.json.reported?.some((r) => r.id === msgId), true);
    check("admin silences A2 for 60 min", (await api("POST", "/api/admin/chat", { as: ADMIN, body: { action: "mute", wallet: A2, minutes: 60 } })).status, 200);
    await sleep(3200);
    const muted = await api("POST", "/api/chat", { as: A2, body: { text: "can I speak?" } });
    check("silenced player posts", muted.status, 403);
    check("…told until when", typeof muted.json.mutedUntil, "number");
    check("admin deletes the message", (await api("POST", "/api/admin/chat", { as: ADMIN, body: { action: "delete", id: msgId } })).status, 200);
    check("deleted message is gone", (await api("GET", "/api/chat", { as: A })).text.includes("ford at dawn"), false);
  }
} finally {
  const inList = `(${players.map((w) => `"${w}"`).join(",")})`;
  await db("DELETE", `players?wallet=in.${encodeURIComponent(inList)}`); // messages and reports go with them
  await db("DELETE", `chat_mutes?wallet=in.${encodeURIComponent(inList)}`);
  for (const w of players) await db("DELETE", `rate_limits?key=like.${encodeURIComponent(`chat:%:${w}`)}`);
}
console.log(failed ? `\n${failed} check(s) FAILED` : "\nall War Council API checks passed");
process.exit(failed ? 1 : 0);
