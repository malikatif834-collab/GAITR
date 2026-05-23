import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { agentRuns, decisionRecords } from "@/lib/db/schema";

/* Single-run detail: agent_run + its joined decision_records row (the
   explainability payload for the runs-explorer right pane). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const [row] = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.id, id))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  let decision = null;
  if (row.decisionRecordId) {
    const [dr] = await db
      .select()
      .from(decisionRecords)
      .where(eq(decisionRecords.id, row.decisionRecordId))
      .limit(1);
    decision = dr ?? null;
  }

  return NextResponse.json({ row, decision });
}
