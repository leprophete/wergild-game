import "server-only";
import { NextResponse } from "next/server";
import { COOLDOWN_MINUTES, GRID_W, MAX_FORCE_PER_CELL } from "@config/game";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getSessionWallet } from "@/lib/auth/session";
import { syncWallet } from "@/lib/chain/sync";

/** Rule refusals raised by game_action(), with the message shown to the player. */
const REFUSALS: Record<string, string> = {
  not_adjacent: "Your Banner must hold a cell touching this one.",
  river: "The river cannot be held.",
  impregnable: "This base camp is impregnable.",
  not_enough_reserve: "Not enough soldiers in reserve.",
  not_enough_here: "You do not have that many soldiers here.",
  ink_still_wet: "The ink is still wet: these soldiers cannot leave yet.",
  cell_cap: `At most ${MAX_FORCE_PER_CELL.toLocaleString("en-US")} force per player on one cell.`,
  no_banner: "Swear your oath to a Banner first.",
  excluded_wallet: "This wallet cannot take part in the war.",
  no_active_season: "No season is running.",
  invalid_destination: "Choose another destination.",
  unknown_cell: "Unknown cell.",
  invalid_amount: "Invalid amount.",
};

export type ActionKind = "deploy" | "withdraw" | "move";

/**
 * Runs one game action for the signed-in wallet. The browser only sends a request;
 * the whole outcome is decided by game_action() in a single Postgres transaction.
 */
export async function runAction(kind: ActionKind, from: number, amount: number, to?: number) {
  const wallet = await getSessionWallet();
  if (!wallet) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  // Anti double-count: re-read the on-chain balance before placing soldiers (rule 6 applied first).
  if (kind !== "withdraw") {
    try {
      await syncWallet(wallet);
    } catch (e) {
      console.error(`${kind}: balance re-read failed`, e);
      return NextResponse.json(
        { error: "chain_unavailable", message: "The chain could not be read. Try again in a moment." },
        { status: 503 },
      );
    }
  }

  const xy = (id: number) => ({ x: id % GRID_W, y: Math.floor(id / GRID_W) });
  const a = xy(from);
  const b = to === undefined ? null : xy(to);
  const { data, error } = await getAdminSupabase().rpc("game_action", {
    p_wallet: wallet,
    p_action: kind,
    p_x: a.x,
    p_y: a.y,
    p_amount: amount,
    p_to_x: b?.x ?? null,
    p_to_y: b?.y ?? null,
    p_max_per_cell: MAX_FORCE_PER_CELL,
    p_cooldown_minutes: COOLDOWN_MINUTES,
  });
  if (error) {
    const message = REFUSALS[error.message];
    if (message) return NextResponse.json({ error: error.message, message }, { status: 409 });
    console.error(`${kind} failed`, error);
    return NextResponse.json({ error: "server_error", message: "Something went wrong. Try again." }, { status: 500 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    ok: true,
    reserve: Number(row.reserve),
    ownerBefore: row.owner_before,
    ownerAfter: row.owner_after,
    toOwnerBefore: row.to_owner_before,
    toOwnerAfter: row.to_owner_after,
    lockedUntil: row.locked_until ? Date.parse(row.locked_until) : null,
  });
}
