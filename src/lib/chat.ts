/**
 * The War Council: one private chat per Banner. Shared by /api/chat (validation) and the panel.
 * The database checks the same rules again (chat_post), so this file is a first gate, not the only one.
 */

export const CHAT_MAX = 280;
/** the panel polls /api/chat?since= this often */
export const CHAT_POLL_MS = 4000;
/** sending: 1 message every 3 s and 20 a minute per wallet */
export const CHAT_GAP_SECONDS = 3;
export const CHAT_PER_MINUTE = 20;

export type Grade = "Warlord" | "Captain" | "Sergeant" | "Soldier" | "Recruit";

export interface ChatMessage {
  id: number;
  /** shortened wallet, AbC1…xYz9 (the full address never leaves the server) */
  author: string;
  grade: Grade;
  body: string;
  at: number;
  mine: boolean;
}

/** a reported message, as /admin sees it (full wallet) */
export interface ReportedMessage {
  id: number;
  wallet: string;
  faction: string;
  body: string;
  at: number;
  reports: number;
  lastReportedAt: number | null;
  mutedUntil: number | null;
}

export const shortWallet = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;

// Same pattern as chat_has_link() in supabase/migrations/20261114100000_war_council.sql.
const TLDS =
  "com|net|org|io|xyz|fun|app|gg|co|me|ru|tv|link|ly|to|sh|so|ai|dev|info|biz|site|online|club|top|pro|finance|money|cash|live|chat|bot|tk|ml|cc|ws|in|uk|de|fr|eu|us|ca|cn|be|nl|es|it|ch|se|jp|kr|vn|id|ph|tr|ua|br|mx|au|nz|pw|lol|wtf|art|store|shop|tech|space|website|click|page|sol|eth|ton|bio|one|win|vip|icu|cyou|buzz|rest|bond|ink|news|zone|world|exchange|market|trade|network|group|codes|tools|games|game";
const LINK_PATTERNS = [
  /(https?|ftp|wss?)\s*:\s*\/\s*\//i,
  /(^|[^a-z0-9])www\s*\./i,
  new RegExp(`[a-z0-9-](\\.|\\s*(\\[\\s*\\.?\\s*\\]|\\(\\s*\\.?\\s*\\)|\\[\\s*dot\\s*\\]|\\(\\s*dot\\s*\\))\\s*)(${TLDS})([^a-z0-9]|$)`, "i"),
];

/** Lookalike letters and invisible characters are folded first, so "ｅvil．com" is caught too. */
export function normalizeMessage(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[​-‏‪-‮⁠-⁤﻿]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

export const hasLink = (text: string) => LINK_PATTERNS.some((p) => p.test(text));

export type ChatRefusal = "empty" | "too_long" | "invalid_message" | "html_not_allowed" | "link_not_allowed";

/** The message as it will be stored, or the reason it is refused. */
export function checkMessage(raw: unknown): { body: string } | { error: ChatRefusal } {
  if (typeof raw !== "string") return { error: "invalid_message" };
  const body = normalizeMessage(raw);
  if (!body) return { error: "empty" };
  if ([...body].length > CHAT_MAX) return { error: "too_long" };
  if (/[\x00-\x08\x0B-\x1F\x7F]/.test(body)) return { error: "invalid_message" };
  if (/<\s*\/?\s*[a-z!][^>]*>/i.test(body)) return { error: "html_not_allowed" };
  if (hasLink(body)) return { error: "link_not_allowed" };
  return { body };
}

export const CHAT_MESSAGES: Record<string, string> = {
  empty: "Write something first.",
  too_long: `At most ${CHAT_MAX} characters.`,
  invalid_message: "That message cannot be sent.",
  html_not_allowed: "Plain text only.",
  link_not_allowed: "No links in the War Council.",
  no_banner: "Swear your oath to a Banner to sit at its War Council.",
  not_your_council: "This is not your Banner's council.",
  excluded_wallet: "This wallet cannot take part in the war.",
  muted: "You have been silenced for a while.",
  no_active_season: "No season is running: the councils are closed.",
  rate_limited: "Slow down: one message every 3 seconds.",
  not_signed_in: "Sign in to sit at the War Council.",
};
