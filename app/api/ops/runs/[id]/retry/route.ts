import { NextResponse } from "next/server";
import { redispatchFromAgentRun } from "@/lib/ops/replay";

/* Re-dispatches a previously-failed agent_run. Same machinery as
   replay, with the failure-only guard for audit clarity. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const result = await redispatchFromAgentRun(id, { onlyFailed: true });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.report, { status: 200 });
}
