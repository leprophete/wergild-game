import { NextResponse } from "next/server";
import { getServerReadSupabase } from "@/lib/supabase/client";
import { loadMapPayload } from "@/lib/map/remote";

export const dynamic = "force-dynamic";

/** GET /api/map — full public state of the current season's map. */
export async function GET() {
  const sb = getServerReadSupabase();
  if (!sb) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  try {
    const payload = await loadMapPayload(sb);
    if (!payload) return NextResponse.json({ error: "No active season" }, { status: 404 });
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("GET /api/map failed", e);
    return NextResponse.json({ error: "Map unavailable" }, { status: 502 });
  }
}
