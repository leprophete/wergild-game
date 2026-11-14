import { NextResponse } from "next/server";
import { z } from "zod";
import { FACTION_IDS } from "@/lib/factions";
import { getSessionWallet } from "@/lib/auth/session";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/http/rateLimit";
import { parseJson } from "@/lib/validation";
import { CHAT_GAP_SECONDS, CHAT_MESSAGES, CHAT_PER_MINUTE, checkMessage, shortWallet, type ChatMessage, type Grade } from "@/lib/chat";

/**
 * The War Council of the caller's Banner. Nothing here trusts the browser: the wallet comes from
 * the signed session cookie, the Banner from the database, and chat_read / chat_post check both
 * again. The tables have RLS and no policy, so this route is the only way in.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const FORBIDDEN = new Set(["no_banner", "not_your_council", "excluded_wallet", "muted"]);
const BAD = new Set(["invalid_message", "html_not_allowed", "link_not_allowed"]);

function refuse(code: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: code, message: CHAT_MESSAGES[code] ?? "Something went wrong.", ...extra }, { status, headers: NO_STORE });
}

function dbError(e: { message?: string; details?: string }, what: string) {
  const code = e.message ?? "";
  if (FORBIDDEN.has(code)) return refuse(code, 403, code === "muted" && e.details ? { mutedUntil: Date.parse(e.details) } : {});
  if (BAD.has(code)) return refuse(code, 400);
  if (code === "no_active_season") return refuse(code, 409);
  console.error(`chat ${what} failed`, e);
  return refuse("server_error", 500);
}

const factionParam = z.enum(FACTION_IDS as unknown as [string, ...string[]]);

type Row = {
  id: number | null;
  wallet: string | null;
  body: string | null;
  created_at: string | null;
  grade: Grade | null;
  mine: boolean | null;
  faction_id: string;
  muted_until: string | null;
};

/** GET /api/chat?since=<last id>[&faction=<id>] — the latest messages of my Banner's council. */
export async function GET(req: Request) {
  const wallet = await getSessionWallet();
  if (!wallet) return refuse("not_signed_in", 401);

  const q = new URL(req.url).searchParams;
  const since = q.get("since") ?? "0";
  const faction = q.get("faction");
  if (!/^\d{1,15}$/.test(since) || (faction !== null && !factionParam.safeParse(faction).success))
    return refuse("invalid_request", 400);

  // polling every 4 s is 15 a minute: 60 leaves room for a few tabs
  const limited = await rateLimit(`chat:read:${wallet}`, 60, 60, "Too many requests. Wait a moment.");
  if (limited) return limited;

  const { data, error } = await getAdminSupabase().rpc("chat_read", {
    p_wallet: wallet,
    p_since: Number(since),
    p_faction: faction,
    p_limit: 50,
  });
  if (error) return dbError(error, "read");
  const rows = (data ?? []) as Row[];
  const messages: ChatMessage[] = rows
    .filter((r) => r.id !== null)
    .map((r) => ({
      id: Number(r.id),
      author: shortWallet(r.wallet!),
      grade: r.grade ?? "Recruit",
      body: r.body!,
      at: Date.parse(r.created_at!),
      mine: !!r.mine,
    }));
  return NextResponse.json(
    {
      faction: rows[0]?.faction_id ?? null,
      mutedUntil: rows[0]?.muted_until ? Date.parse(rows[0].muted_until) : null,
      messages,
    },
    { headers: NO_STORE },
  );
}

const postSchema = z.object({ text: z.string().max(2000), faction: factionParam.optional() }).strict();

/** POST /api/chat { text } — speak at my Banner's council. */
export async function POST(req: Request) {
  const wallet = await getSessionWallet();
  if (!wallet) return refuse("not_signed_in", 401);

  const body = await parseJson(req, postSchema);
  if (!body) return refuse("invalid_request", 400);
  const checked = checkMessage(body.text);
  if ("error" in checked) return refuse(checked.error, 400);

  // 1 message every 3 s, and 20 a minute
  const gap = await rateLimit(`chat:gap:${wallet}`, 1, CHAT_GAP_SECONDS, CHAT_MESSAGES.rate_limited);
  if (gap) return gap;
  const minute = await rateLimit(`chat:min:${wallet}`, CHAT_PER_MINUTE, 60, "At most 20 messages a minute.");
  if (minute) return minute;

  const { data, error } = await getAdminSupabase().rpc("chat_post", { p_wallet: wallet, p_body: checked.body, p_faction: body.faction ?? null });
  if (error) return dbError(error, "post");
  const row = (Array.isArray(data) ? data[0] : data) as { id: number; created_at: string };
  return NextResponse.json({ ok: true, id: Number(row.id), at: Date.parse(row.created_at) }, { status: 201, headers: NO_STORE });
}
