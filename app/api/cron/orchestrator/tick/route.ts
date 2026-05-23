import { NextResponse } from "next/server";
import { runTick } from "@/lib/orchestrator/tick";
import { authorizeCron } from "@/lib/ops/auth";

/* Vercel cron hits this every 15 min (vercel.json `crons`). Header
   check accepts the Vercel-injected CRON_SECRET *or* the OPS_ADMIN_TOKEN
   so an operator can trigger from a terminal with the ops token. ADR
   0005 D2 + D5. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const report = await runTick({ reason: "cron" });
    return NextResponse.json(report, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "tick-failed", message },
      { status: 500 },
    );
  }
}

/* Allow GET too — Vercel's cron infrastructure issues GETs by default;
   POST is just as supported but the GET path keeps `curl /api/cron/...`
   ergonomic for manual checks. */
export async function GET(request: Request) {
  return POST(request);
}
