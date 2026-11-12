import { NextResponse } from "next/server";
import { z } from "zod";
import * as G from "@config/game";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { adminError, requireAdmin, sameOrigin } from "@/lib/auth/admin";
import { parseJson } from "@/lib/validation";

const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("schedule"),
      type: z.enum(["tithe", "plague", "rush"]),
      x: z.number().int().min(0).max(G.GRID_W - 1).nullable(),
      y: z.number().int().min(0).max(G.GRID_H - 1).nullable(),
      startsAt: z.number().int(),
    })
    .strict(),
  z.object({ action: z.literal("cancel"), eventId: z.number().int().positive() }).strict(),
]);

/** POST /api/admin/events — schedule (≥ 6 h ahead) or call off an event. Admin wallet only. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const body = await parseJson(req, schema);
  if (!body) return NextResponse.json({ error: "invalid_request", message: "Invalid request." }, { status: 400 });

  const sb = getAdminSupabase();
  const r =
    body.action === "cancel"
      ? await sb.rpc("admin_cancel_event", { p_event_id: body.eventId })
      : await sb.rpc("admin_schedule_event", {
          p_type: body.type,
          p_x: body.x,
          p_y: body.y,
          p_starts_at: new Date(body.startsAt).toISOString(),
          p_notice_hours: G.EVENT_NOTICE_HOURS,
          p_tithe_size: G.TITHE_SIZE,
          p_tithe_hours: G.TITHE_HOURS,
          p_plague_size: G.PLAGUE_SIZE,
          p_rush_hours: G.RUSH_HOURS,
          p_grid_w: G.GRID_W,
          p_grid_h: G.GRID_H,
        });
  if (r.error) return adminError(r.error);
  console.info(`admin ${auth.wallet}: event ${body.action}`, body);
  return NextResponse.json({ ok: true, result: r.data ?? null });
}
