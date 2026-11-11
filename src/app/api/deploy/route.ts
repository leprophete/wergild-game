import { NextResponse } from "next/server";
import { runAction } from "@/lib/game/action";
import { cellActionSchema, parseJson } from "@/lib/validation";

/** POST /api/deploy { cellId, amount } — places force from the reserve (rule 4). */
export async function POST(req: Request) {
  const body = await parseJson(req, cellActionSchema);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  return runAction("deploy", body.cellId, body.amount);
}
