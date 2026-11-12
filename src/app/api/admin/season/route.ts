import { NextResponse } from "next/server";
import { z } from "zod";
import { SEASON_DAYS } from "@config/game";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { adminError, requireAdmin, sameOrigin } from "@/lib/auth/admin";
import { parseJson } from "@/lib/validation";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().trim().min(3).max(60), startsAt: z.number().int() }).strict(),
  z.object({ action: z.literal("rename"), seasonId: z.number().int().positive(), name: z.string().trim().min(3).max(60) }).strict(),
  // rings the knell now; the confirmation word guards against a stray click
  z.object({ action: z.literal("end"), seasonId: z.number().int().positive(), confirm: z.literal("KNELL") }).strict(),
]);

/** POST /api/admin/season — plan a season, rename it, or ring the knell early. Admin wallet only. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const body = await parseJson(req, schema);
  if (!body) return NextResponse.json({ error: "invalid_request", message: "Invalid request." }, { status: 400 });

  const sb = getAdminSupabase();
  const r =
    body.action === "create"
      ? await sb.rpc("admin_create_season", {
          p_name: body.name,
          p_starts_at: new Date(body.startsAt).toISOString(),
          p_season_days: SEASON_DAYS,
        })
      : body.action === "rename"
        ? await sb.rpc("admin_rename_season", { p_season_id: body.seasonId, p_name: body.name })
        : await sb.rpc("end_season", { p_season_id: body.seasonId, p_early: true, p_season_days: SEASON_DAYS });
  if (r.error) return adminError(r.error);
  console.info(`admin ${auth.wallet}: season ${body.action}`, body);
  return NextResponse.json({ ok: true, result: r.data ?? null });
}
