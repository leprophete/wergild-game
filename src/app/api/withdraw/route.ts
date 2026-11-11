import { NextResponse } from "next/server";
import { runAction } from "@/lib/game/action";
import { cellActionSchema, parseJson } from "@/lib/validation";

/** POST /api/withdraw { cellId, amount } — sends force back to reserve once the ink is dry. */
export async function POST(req: Request) {
  const body = await parseJson(req, cellActionSchema);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  return runAction("withdraw", body.cellId, body.amount);
}
