import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { adminError, requireAdmin, sameOrigin } from "@/lib/auth/admin";
import { parseJson, walletSchema } from "@/lib/validation";
import type { ReportedMessage } from "@/lib/chat";

export const dynamic = "force-dynamic";

const t = (s: string | null) => (s ? Date.parse(s) : null);

/** GET /api/admin/chat — the reported War Council messages. Admin wallet only. */
export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { data, error } = await getAdminSupabase().rpc("admin_chat_reported");
  if (error) return adminError(error);
  const reported: ReportedMessage[] = (data ?? []).map(
    (r: { id: number; wallet: string; faction_id: string; body: string; created_at: string; reports: number; last_reported_at: string | null; muted_until: string | null }) => ({
      id: Number(r.id),
      wallet: r.wallet,
      faction: r.faction_id,
      body: r.body,
      at: Date.parse(r.created_at),
      reports: r.reports,
      lastReportedAt: t(r.last_reported_at),
      mutedUntil: t(r.muted_until),
    }),
  );
  return NextResponse.json({ reported }, { headers: { "Cache-Control": "no-store" } });
}

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete"), id }).strict(),
  z.object({ action: z.literal("dismiss"), id }).strict(),
  // 0 lifts the mute; at most 90 days
  z.object({ action: z.literal("mute"), wallet: walletSchema, minutes: z.number().int().min(0).max(60 * 24 * 90) }).strict(),
]);

/** POST /api/admin/chat — delete or clear a reported message, or silence a wallet for a while. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const body = await parseJson(req, schema);
  if (!body) return NextResponse.json({ error: "invalid_request", message: "Invalid request." }, { status: 400 });
  const sb = getAdminSupabase();
  const r =
    body.action === "mute"
      ? await sb.rpc("admin_chat_mute", { p_wallet: body.wallet, p_minutes: body.minutes, p_by: auth.wallet })
      : await sb.rpc(body.action === "delete" ? "admin_chat_delete" : "admin_chat_dismiss", { p_message_id: body.id });
  if (r.error) return adminError(r.error);
  console.info(`admin ${auth.wallet}: chat ${body.action} ${"id" in body ? body.id : `${body.wallet} ${body.minutes} min`}`);
  return NextResponse.json({ ok: true, mutedUntil: body.action === "mute" && r.data ? Date.parse(r.data as string) : null });
}
