import { NextResponse } from "next/server";
import { ACTIONS_PER_MINUTE, FACTION_CAP_PCT, FACTION_SWITCHES_PER_SEASON } from "@config/game";
import { rateLimit } from "@/lib/http/rateLimit";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getSessionWallet } from "@/lib/auth/session";
import { joinRequestSchema, parseJson } from "@/lib/validation";

const RULE_ERRORS: Record<string, { status: number; message: string }> = {
  banner_closed: { status: 409, message: "This Banner holds too much of the realm. It is closed to newcomers for now." },
  no_switch_left: { status: 409, message: "You have already changed Banner this season." },
  excluded_wallet: { status: 403, message: "This wallet cannot take part in the war." },
  unknown_banner: { status: 400, message: "Unknown Banner." },
  unknown_player: { status: 401, message: "Sign in again." },
};

/** POST /api/faction/join { factionId } — join or switch Banner (rule 3), one Postgres transaction. */
export async function POST(req: Request) {
  const wallet = await getSessionWallet();
  if (!wallet) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  const limited = await rateLimit(`act:${wallet}`, ACTIONS_PER_MINUTE, 60);
  if (limited) return limited;
  const body = await parseJson(req, joinRequestSchema);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const { data, error } = await getAdminSupabase().rpc("join_faction", {
    p_wallet: wallet,
    p_faction: body.factionId,
    p_cap_pct: FACTION_CAP_PCT,
    p_max_switches: FACTION_SWITCHES_PER_SEASON,
  });
  if (error) {
    const rule = RULE_ERRORS[error.message];
    if (rule) return NextResponse.json({ error: error.message, message: rule.message }, { status: rule.status });
    console.error("join_faction failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ factionId: row.faction_id, switched: row.switched, switchesLeft: row.switches_left });
}
