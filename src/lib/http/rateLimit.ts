import "server-only";
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * Rate limiting kept in Postgres (hit_rate_limit: one atomic upsert), so it holds across every
 * server instance. Returns a 429 response to send back as is, or null when the request may go on.
 * If the database cannot answer, the request goes on (the game must not stop for a counter).
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  message = "Too many orders at once. Wait a moment.",
): Promise<NextResponse | null> {
  const { data, error } = await getAdminSupabase().rpc("hit_rate_limit", {
    p_key: key.slice(0, 120),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed (request allowed)", error);
    return null;
  }
  if (data === true) return null;
  return NextResponse.json(
    { error: "rate_limited", message },
    { status: 429, headers: { "Retry-After": String(windowSeconds) } },
  );
}

/** The caller's IP, as set by the hosting proxy (Vercel: x-forwarded-for, first entry). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip") ?? "").trim();
  return ip || "unknown";
}
