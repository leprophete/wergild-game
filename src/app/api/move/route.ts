import { NextResponse } from "next/server";
import { runAction } from "@/lib/game/action";
import { moveSchema, parseJson } from "@/lib/validation";

/** POST /api/move { fromCellId, toCellId, amount } — withdraw and redeploy in one transaction. */
export async function POST(req: Request) {
  const body = await parseJson(req, moveSchema);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  return runAction("move", body.fromCellId, body.amount, body.toCellId);
}
