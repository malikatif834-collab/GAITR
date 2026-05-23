import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { agentRuns } from "@/lib/db/schema";
import { ingestSource } from "@/lib/pipeline/ingest";
import { extractFromIncident } from "@/lib/pipeline/extract";
import { correlateIncident } from "@/lib/pipeline/correlate";
import { mapSubject } from "@/lib/pipeline/map";
import { composeBrief } from "@/lib/pipeline/report";
import { synthesizeStage } from "@/lib/pipeline/synthesize";
import type { StageId, Subject } from "@/lib/pipeline/types";

/* Shared core for /api/ops/runs/:id/{replay,retry}. Reads the original
   agent_run, validates the input shape per stage, and re-dispatches
   the same work with a fresh idempotencyOverride so the original row
   is preserved and a new agent_run row carries the audit trail. */

export type ReplayResult =
  | {
      ok: true;
      report: {
        originalAgentRunId: string;
        stageId: string;
        newAgentRunId: string;
        cached: boolean;
        status: string;
      };
    }
  | {
      ok: false;
      error: string;
      message: string;
      status: number;
    };

export async function redispatchFromAgentRun(
  id: string,
  opts: { onlyFailed: boolean },
): Promise<ReplayResult> {
  const [row] = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.id, id))
    .limit(1);
  if (!row) {
    return {
      ok: false,
      error: "not-found",
      message: `no agent_run with id ${id}`,
      status: 404,
    };
  }
  if (opts.onlyFailed && row.status !== "failed") {
    return {
      ok: false,
      error: "not-failed",
      message: `retry only valid for status='failed' rows; this row is '${row.status}'`,
      status: 422,
    };
  }
  if (!row.input) {
    return {
      ok: false,
      error: "no-input",
      message:
        "this agent_run predates the `input` column (migration 0002) — replay it manually via /api/ops/stages/:stageId/trigger",
      status: 422,
    };
  }

  const idempotencyOverride = crypto.randomUUID();
  const input = row.input as Record<string, unknown>;
  try {
    const out = await dispatchByStage(row.stageId as StageId, input, {
      idempotencyOverride,
    });
    return {
      ok: true,
      report: {
        originalAgentRunId: row.id,
        stageId: row.stageId,
        newAgentRunId: out.agentRunId,
        cached: out.cached,
        status: out.status,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: "dispatch-failed",
      message: err instanceof Error ? err.message : String(err),
      status: 500,
    };
  }
}

async function dispatchByStage(
  stageId: StageId,
  input: Record<string, unknown>,
  opts: { idempotencyOverride: string },
): Promise<{ agentRunId: string; cached: boolean; status: string }> {
  switch (stageId) {
    case "ingest": {
      if (typeof input.sourceId !== "string") {
        throw new Error("ingest input missing sourceId");
      }
      const out = await ingestSource(input.sourceId, opts);
      return metaToResult(out.meta);
    }
    case "extract": {
      if (typeof input.incidentId !== "string") {
        throw new Error("extract input missing incidentId");
      }
      const out = await extractFromIncident(input.incidentId, opts);
      return metaToResult(out.meta);
    }
    case "correlate": {
      if (typeof input.incidentId !== "string") {
        throw new Error("correlate input missing incidentId");
      }
      const out = await correlateIncident(input.incidentId, opts);
      return metaToResult(out.meta);
    }
    case "map": {
      const out = await mapSubject(input as unknown as Subject, opts);
      return metaToResult(out.meta);
    }
    case "report": {
      const out = await composeBrief(input as unknown as Subject, opts);
      return metaToResult(out.meta);
    }
    case "synthesize": {
      if (!Array.isArray(input.toolIds)) {
        throw new Error("synthesize input missing toolIds[]");
      }
      const out = await synthesizeStage(
        { toolIds: input.toolIds as string[] },
        opts,
      );
      return metaToResult(out.meta);
    }
  }
}

function metaToResult(meta: {
  agentRunId: string;
  cached: boolean;
  status: string;
}): { agentRunId: string; cached: boolean; status: string } {
  return {
    agentRunId: meta.agentRunId,
    cached: meta.cached,
    status: meta.status,
  };
}
