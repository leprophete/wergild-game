import { NextResponse } from "next/server";
import { FACTION_CAP_PCT } from "@config/game";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { FactionId } from "@/lib/factions";
import type { BannerStatus } from "@/lib/game/types";

export const dynamic = "force-dynamic";

/** GET /api/factions — public aggregates for /join: members, force, share, closed (35 % cap). */
export async function GET() {
  const { data, error } = await getAdminSupabase().rpc("banner_status");
  if (error) {
    console.error("banner_status failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  const banners: BannerStatus[] = (data ?? []).map(
    (r: { faction_id: string; members: number; force: number; share_pct: number }) => ({
      faction: r.faction_id as FactionId,
      members: Number(r.members),
      force: Number(r.force),
      sharePct: Number(r.share_pct),
      closed: Number(r.share_pct) > FACTION_CAP_PCT,
    }),
  );
  return NextResponse.json(banners, { headers: { "Cache-Control": "no-store" } });
}
