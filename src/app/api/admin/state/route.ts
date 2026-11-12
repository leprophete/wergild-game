import { NextResponse } from "next/server";
import * as G from "@config/game";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin";
import type { AdminState } from "@/lib/game/admin";

export const dynamic = "force-dynamic";

const t = (s: string | null) => (s ? Date.parse(s) : null);

/** GET /api/admin/state — seasons, events, excluded wallets, parameters. Admin wallet only. */
export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const sb = getAdminSupabase();
  const [seasons, events, excluded] = await Promise.all([
    sb.from("seasons").select("id, number, name, starts_at, ends_at, status, winner_faction_id").order("number", { ascending: false }),
    sb
      .from("events")
      .select("id, type, zone_x, zone_y, zone_w, zone_h, announced_at, starts_at, ends_at, applied_at, seasons!inner(number, status)")
      .in("seasons.status", ["active", "scheduled"])
      .order("starts_at"),
    sb.from("players").select("wallet, faction_id").eq("is_excluded", true).order("wallet"),
  ]);
  const err = seasons.error ?? events.error ?? excluded.error;
  if (err) {
    console.error("admin state: read failed", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const body: AdminState = {
    wallet: auth.wallet,
    seasons: (seasons.data ?? []).map((s) => ({
      id: s.id,
      number: s.number,
      name: s.name,
      startsAt: Date.parse(s.starts_at),
      endsAt: Date.parse(s.ends_at),
      status: s.status,
      winner: s.winner_faction_id,
    })),
    events: (events.data ?? []).map((e) => ({
      id: e.id,
      seasonNumber: (e.seasons as unknown as { number: number }).number,
      type: e.type,
      zone: e.zone_x === null ? null : { x: e.zone_x, y: e.zone_y, w: e.zone_w, h: e.zone_h },
      announcedAt: Date.parse(e.announced_at),
      startsAt: Date.parse(e.starts_at),
      endsAt: Date.parse(e.ends_at),
      appliedAt: t(e.applied_at),
    })),
    excluded: (excluded.data ?? []).map((p) => ({ wallet: p.wallet, faction: p.faction_id })),
    params: [
      ["Tokens per soldier", G.TOKENS_PER_SOLDIER],
      ["Veteran bonus: full at (days)", G.VETERAN_MAX_DAYS],
      ["Banner changes per season", G.FACTION_SWITCHES_PER_SEASON],
      ["Banner cap (% of total force)", G.FACTION_CAP_PCT],
      ["Max force per player per cell", G.MAX_FORCE_PER_CELL],
      ["Wet ink (minutes)", G.COOLDOWN_MINUTES],
      ["Points per cell / watchtower", `${G.CELL_POINTS} / ${G.BONUS_CELL_POINTS}`],
      ["Season length (days)", G.SEASON_DAYS],
      ["Event notice (hours)", G.EVENT_NOTICE_HOURS],
      ["Tithe", `${G.TITHE_SIZE}×${G.TITHE_SIZE}, ×${G.TITHE_MULTIPLIER}, ${G.TITHE_HOURS} h`],
      ["Plague zone", `${G.PLAGUE_SIZE}×${G.PLAGUE_SIZE}`],
      ["Rush (hours)", G.RUSH_HOURS],
      ["Cluster", G.SOLANA_CLUSTER],
      ["Token mint", G.TOKEN_MINT || "—"],
    ].map(([label, value]) => ({ label: String(label), value: typeof value === "number" ? value.toLocaleString("en-US") : String(value) })),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
