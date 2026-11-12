import { NextResponse } from "next/server";
import { FACTION_IDS, type FactionId } from "@/lib/factions";
import { loadBanner } from "@/lib/game/banner";

/** GET /api/banner/[name] — a Banner's territory, members, top contributors and points history. */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!FACTION_IDS.includes(name as FactionId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    return NextResponse.json(await loadBanner(name as FactionId), { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (e) {
    console.error("GET /api/banner failed", e);
    return NextResponse.json({ error: "server_error" }, { status: 502 });
  }
}
