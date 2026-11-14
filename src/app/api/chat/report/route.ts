import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionWallet } from "@/lib/auth/session";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/http/rateLimit";
import { parseJson } from "@/lib/validation";
import { CHAT_MESSAGES } from "@/lib/chat";

const schema = z.object({ id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict();

/** POST /api/chat/report { id } — flag a message of my own council for the admins. */
export async function POST(req: Request) {
  const wallet = await getSessionWallet();
  if (!wallet) return NextResponse.json({ error: "not_signed_in", message: CHAT_MESSAGES.not_signed_in }, { status: 401 });
  const body = await parseJson(req, schema);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const limited = await rateLimit(`chat:report:${wallet}`, 10, 60, "Too many reports. Wait a moment.");
  if (limited) return limited;

  const { error } = await getAdminSupabase().rpc("chat_report", { p_wallet: wallet, p_message_id: body.id });
  if (error) {
    if (error.message === "no_banner" || error.message === "not_your_council")
      return NextResponse.json({ error: error.message, message: CHAT_MESSAGES[error.message] }, { status: 403 });
    console.error("chat report failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
