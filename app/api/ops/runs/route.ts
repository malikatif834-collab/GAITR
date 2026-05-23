import { NextResponse } from "next/server";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { agentRuns, decisionRecords } from "@/lib/db/schema";

/* Paginated agent_runs listing for the ops runs-explorer. Auth via
   middleware. Filters: stage, status, limit (capped at 200),
   orchestratorOnly (joins on decision_records.agent_name). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STAGES = new Set([
  "ingest",
  "extract",
  "correlate",
  "synthesize",
  "map",
  "report",
]);
const VALID_STATUSES = new Set(["succeeded", "failed", "running"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const stage = url.searchParams.get("stage");
  const status = url.searchParams.get("status");
  const orchestratorOnly = url.searchParams.get("orchestratorOnly") === "true";
  const limit = Math.max(
    1,
    Math.min(200, Number(url.searchParams.get("limit") ?? "50")),
  );

  const where = [];
  if (stage && VALID_STAGES.has(stage)) where.push(eq(agentRuns.stageId, stage));
  if (status && VALID_STATUSES.has(status))
    where.push(eq(agentRuns.status, status));
  if (orchestratorOnly) where.push(isNotNull(agentRuns.decisionRecordId));

  const rowsBase = where.length
    ? db
        .select()
        .from(agentRuns)
        .where(and(...where))
        .orderBy(desc(agentRuns.startedAt))
        .limit(limit)
    : db
        .select()
        .from(agentRuns)
        .orderBy(desc(agentRuns.startedAt))
        .limit(limit);

  const rows = await rowsBase;

  let decisionMap = new Map<string, { agentName: string; promptVersion: string; modelId: string }>();
  if (rows.length > 0) {
    const drIds = rows
      .map((r) => r.decisionRecordId)
      .filter((id): id is string => id !== null);
    if (drIds.length > 0) {
      const drs = await db
        .select({
          id: decisionRecords.id,
          agentName: decisionRecords.agentName,
          promptVersion: decisionRecords.promptVersion,
          modelId: decisionRecords.modelId,
        })
        .from(decisionRecords)
        .where(inArray(decisionRecords.id, drIds));
      decisionMap = new Map(
        drs.map((d) => [
          d.id,
          {
            agentName: d.agentName,
            promptVersion: d.promptVersion,
            modelId: d.modelId,
          },
        ]),
      );
    }
  }

  let filtered = rows;
  if (orchestratorOnly) {
    filtered = rows.filter((r) => {
      if (!r.decisionRecordId) return false;
      const dr = decisionMap.get(r.decisionRecordId);
      return dr?.agentName === "orchestrator";
    });
  }

  return NextResponse.json({
    rows: filtered.map((r) => ({
      id: r.id,
      stageId: r.stageId,
      status: r.status,
      idempotencyKey: r.idempotencyKey,
      inputHash: r.inputHash,
      outputHash: r.outputHash,
      decisionRecordId: r.decisionRecordId,
      decisionRecord: r.decisionRecordId
        ? (decisionMap.get(r.decisionRecordId) ?? null)
        : null,
      errorMessage: r.errorMessage,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
    })),
    count: filtered.length,
    limit,
  });
}
