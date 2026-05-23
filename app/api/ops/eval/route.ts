import { NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { evalResults } from "@/lib/db/schema";
import { EVAL_METRICS } from "@/lib/orchestrator/eval";

/* Powers the ops scorecard. Returns the latest value per (stage_id,
   metric) plus a 14-row sparkline history for each metric. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPARKLINE_DAYS = 14;

export async function GET() {
  // DISTINCT ON (stage_id, metric) — Postgres-only but fits Drizzle's
  // sql template trivially. Returns most-recent row per metric.
  const latest = await db.execute(
    sql`
      select distinct on (stage_id, metric)
        id, stage_id, metric, value, sample_size, window_start, window_end, created_at
      from eval_results
      order by stage_id, metric, created_at desc
    `,
  );

  // Sparkline: last 14 rows per metric, oldest→newest.
  const sparklineByMetric: Record<
    string,
    Array<{ value: number; createdAt: string; sampleSize: number | null }>
  > = {};
  for (const metric of EVAL_METRICS) {
    const rows = await db
      .select({
        value: evalResults.value,
        createdAt: evalResults.createdAt,
        sampleSize: evalResults.sampleSize,
      })
      .from(evalResults)
      .where(sql`metric = ${metric}`)
      .orderBy(desc(evalResults.createdAt))
      .limit(SPARKLINE_DAYS);
    sparklineByMetric[metric] = rows
      .map((r) => ({
        value: Number(r.value),
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : String(r.createdAt),
        sampleSize: r.sampleSize,
      }))
      .reverse();
  }

  const live = (latest as unknown as Array<{
    id: string;
    stage_id: string;
    metric: string;
    value: string;
    sample_size: number | null;
    window_start: string | null;
    window_end: string | null;
    created_at: string;
  }>).map((r) => ({
    id: r.id,
    stageId: r.stage_id,
    metric: r.metric,
    value: Number(r.value),
    sampleSize: r.sample_size,
    windowStart: r.window_start,
    windowEnd: r.window_end,
    createdAt: r.created_at,
  }));

  return NextResponse.json({
    live,
    sparklines: sparklineByMetric,
    deferred: [
      {
        metric: "synthesize.reviewer_override_rate",
        reason:
          "needs Phase 4 reviewer data (feedback_events on synthesized scenarios)",
      },
      {
        metric: "map.expert_agreement",
        reason: "needs Phase 5 labelled SAIF holdout set",
      },
    ],
  });
}
