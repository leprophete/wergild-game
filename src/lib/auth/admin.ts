import "server-only";
import { NextResponse } from "next/server";
import { getSessionWallet } from "./session";

/** Admin wallets come from the server environment only (no is_admin column, SPEC "Anti-triche"). */
function adminWallets(): Set<string> {
  return new Set(
    (process.env.ADMIN_WALLETS ?? "")
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean),
  );
}

/** The signed-in admin wallet, or a 401/403 response to return as is. */
export async function requireAdmin(): Promise<{ wallet: string } | { response: NextResponse }> {
  const wallet = await getSessionWallet();
  if (!wallet) return { response: NextResponse.json({ error: "not_signed_in" }, { status: 401 }) };
  if (!adminWallets().has(wallet)) return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { wallet };
}

/** Same-origin check for admin writes (on top of the SameSite=Lax cookie). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetch from older browsers / curl with a cookie
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

/** Database refusals raised by the admin functions, with the message shown on /admin. */
export const ADMIN_REFUSALS: Record<string, string> = {
  season_exists: "A season is already running or planned.",
  invalid_name: "The name must be 3 to 60 characters.",
  not_monday_17_utc: "A season opens on a Monday at 17:00 UTC.",
  start_in_the_past: "That Monday is long gone.",
  no_layout: "No map layout to copy.",
  season_not_open: "That season is over.",
  season_not_active: "No season is running.",
  season_not_over: "The season is not over.",
  not_on_the_hour: "Events start on a full hour (UTC).",
  too_soon: "Events must be announced at least 6 hours ahead.",
  outside_season: "No running or planned season at that time.",
  zone_off_map: "The zone does not fit on the map.",
  one_tithe_per_day: "There is already a Tithe that day (UTC).",
  one_plague_per_season: "This season already has its Plague.",
  one_rush_per_week: "There is already a Rush that week.",
  event_started_or_unknown: "That event has begun (or does not exist).",
  invalid_wallet: "Not a wallet address.",
  message_not_found: "That message is already gone.",
  invalid_duration: "Choose a duration between a minute and 90 days.",
};

export function adminError(e: { message?: string } | null) {
  const key = Object.keys(ADMIN_REFUSALS).find((k) => e?.message?.includes(k));
  if (key) return NextResponse.json({ error: key, message: ADMIN_REFUSALS[key] }, { status: 400 });
  console.error("admin: database error", e);
  return NextResponse.json({ error: "server_error", message: "Something went wrong." }, { status: 500 });
}
