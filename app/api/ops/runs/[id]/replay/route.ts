import { NextResponse } from "next/server";
import { redispatchFromAgentRun } from "@/lib/ops/replay";

/* Re-dispatches the same work the original agent_run did, with a fresh
   idempotency override. Preserves the original row (writes a new one).
   Replay is for curiosity / regression checks; retry (sibling route)
   is the failure-recovery flavour. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const result = await redispatchFromAgentRun(id, { onlyFailed: false });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.report, { status: 200 });
}
