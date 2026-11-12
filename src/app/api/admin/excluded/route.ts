import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { adminError, requireAdmin, sameOrigin } from "@/lib/auth/admin";
import { parseJson, walletSchema } from "@/lib/validation";

const schema = z.object({ wallet: walletSchema, excluded: z.boolean() }).strict();

/** POST /api/admin/excluded — exclude a wallet from the war (rule 10) or let it back in. Admin wallet only. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const body = await parseJson(req, schema);
  if (!body) return NextResponse.json({ error: "invalid_request", message: "Not a wallet address." }, { status: 400 });
  const r = await getAdminSupabase().rpc("admin_set_excluded", { p_wallet: body.wallet, p_excluded: body.excluded });
  if (r.error) return adminError(r.error);
  console.info(`admin ${auth.wallet}: ${body.excluded ? "excluded" : "readmitted"} ${body.wallet}`);
  return NextResponse.json({ ok: true });
}
