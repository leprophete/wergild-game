import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase/client";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { loadMapPayload } from "@/lib/map/remote";

export const dynamic = "force-dynamic";

/**
 * GET /api/map — full public state of the current season's map.
 * Read with the server key: map_strengths (force per Banner and per cell, aggregated from the
 * private deployments) is not callable from outside; only these aggregates leave the server.
 */
export async function GET() {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  try {
    const payload = await loadMapPayload(getAdminSupabase());
    if (!payload) return NextResponse.json({ error: "No active season" }, { status: 404 });
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("GET /api/map failed", e);
    return NextResponse.json({ error: "Map unavailable" }, { status: 502 });
  }
}
