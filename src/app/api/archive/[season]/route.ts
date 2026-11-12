import { NextResponse } from "next/server";
import { getServerReadSupabase } from "@/lib/supabase/client";
import { loadArchive } from "@/lib/game/archive";

/** GET /api/archive/[season] — one archived season, read-only (season number). */
export async function GET(_req: Request, ctx: { params: Promise<{ season: string }> }) {
  const { season } = await ctx.params;
  const n = Number(season);
  if (!/^\d{1,6}$/.test(season) || !Number.isSafeInteger(n)) {
    return NextResponse.json({ error: "invalid_season" }, { status: 400 });
  }
  const sb = getServerReadSupabase();
  if (!sb) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  try {
    const page = await loadArchive(sb, n);
    if (!page) return NextResponse.json({ error: "not_found" }, { status: 404 });
    // a finished season never changes
    return NextResponse.json(page, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    console.error("GET /api/archive/[season] failed", e);
    return NextResponse.json({ error: "server_error" }, { status: 502 });
  }
}
