import { NextResponse } from "next/server";
import { runTick } from "@/lib/orchestrator/tick";
import { authorizeOps } from "@/lib/ops/auth";

/* Operator-triggered tick — same handler as the cron endpoint, gated by
   the env-var OPS_ADMIN_TOKEN. Surfaced as "Run a tick" on /ops. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!authorizeOps(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const report = await runTick({ reason: "manual" });
    return NextResponse.json(report, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "tick-failed", message },
      { status: 500 },
    );
  }
}
