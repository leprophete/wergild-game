import { NextResponse } from "next/server";
import { getServerReadSupabase } from "@/lib/supabase/client";
import { listArchives } from "@/lib/game/archive";

export const dynamic = "force-dynamic";

/** GET /api/archive — the Chronicles: every finished season and its winner (the Hall of Fame). */
export async function GET() {
  const sb = getServerReadSupabase();
  if (!sb) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  try {
    return NextResponse.json(await listArchives(sb), { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (e) {
    console.error("GET /api/archive failed", e);
    return NextResponse.json({ error: "server_error" }, { status: 502 });
  }
}
