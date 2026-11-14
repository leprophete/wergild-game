/**
 * War Council message checks (src/lib/chat.ts). Run: npx tsx tests/chat.test.ts
 * The same link pattern is tested on the database side in supabase/tests/chat_rules.sql.
 */
import assert from "node:assert/strict";
import { CHAT_MAX, checkMessage, hasLink, shortWallet } from "../src/lib/chat";

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("ok  " + name);
};

const refused = (t: string) => {
  const r = checkMessage(t);
  return "error" in r ? r.error : null;
};

test("links and domain names are refused", () => {
  for (const t of [
    "see https://evil.example",
    "HTTP : // x",
    "www.pump.fun now",
    "join t.me/goblins",
    "buy at pump.fun",
    "dexscreener.com/solana",
    "go to discord.gg/abc",
    "evil[.]com",
    "evil (dot) xyz",
    "GOOGLE.COM",
    "wergild.sol",
  ])
    assert.equal(refused(t), "link_not_allowed", t);
});

test("disguised links are folded first (full-width letters, zero-width spaces)", () => {
  assert.equal(refused("ｅｖｉｌ．ｃｏｍ"), "link_not_allowed");
  assert.equal(refused("evil​.com"), "link_not_allowed");
});

test("ordinary sentences pass", () => {
  for (const t of [
    "Hold the line. In the morning we march.",
    "e.g. take M-25 first",
    "up 3.5k soldiers",
    "gg wp",
    "meet at the ford at 5 p.m.",
    "the dot on the map",
    "Knaves to the east! <3",
  ])
    assert.equal(refused(t), null, t);
});

test("HTML is refused, plain text is kept as typed", () => {
  assert.equal(refused("<img src=x onerror=alert(1)>"), "html_not_allowed");
  assert.equal(refused("<script>alert(1)</script>"), "html_not_allowed");
  assert.deepEqual(checkMessage("  To the ford!  "), { body: "To the ford!" });
});

test("length: 280 characters at most, empty refused", () => {
  assert.equal(refused("x".repeat(CHAT_MAX)), null);
  assert.equal(refused("x".repeat(CHAT_MAX + 1)), "too_long");
  assert.equal(refused("   "), "empty");
  assert.equal(refused(42 as unknown as string), "invalid_message");
  assert.equal(refused("bell\u0007"), "invalid_message");
});

test("the author is shown as a shortened wallet", () => {
  assert.equal(shortWallet("AbC1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxyz9"), "AbC1…xyz9");
  assert.equal(hasLink("AbC1…xyz9"), false);
});

console.log(`\n${passed} chat tests passed`);
