import { ingestSource } from "@/lib/pipeline/ingest";
import { extractFromIncident } from "@/lib/pipeline/extract";
import { correlateIncident } from "@/lib/pipeline/correlate";
import { mapSubject } from "@/lib/pipeline/map";
import { composeBrief } from "@/lib/pipeline/report";
import type { ActionResult, PlannedAction } from "./types";

/**
 * Dispatch a planned action via the appropriate stage function. Wraps
 * every call in try/catch so one stage failure doesn't blow up the
 * whole tick — the failing action is surfaced on the ops page and the
 * planner will re-attempt next tick (runStage's failed→running reclaim
 * handles the retry atomically).
 */
export async function dispatchAction(
  action: PlannedAction,
): Promise<ActionResult> {
  try {
    switch (action.kind) {
      case "ingest": {
        const out = await ingestSource(action.sourceId);
        return resultFromMeta(action, out.meta);
      }
      case "extract": {
        const out = await extractFromIncident(action.incidentId);
        return resultFromMeta(action, out.meta);
      }
      case "correlate": {
        const out = await correlateIncident(action.incidentId);
        return resultFromMeta(action, out.meta);
      }
      case "map": {
        const out = await mapSubject(action.subject);
        return resultFromMeta(action, out.meta);
      }
      case "report": {
        const out = await composeBrief(action.subject);
        return resultFromMeta(action, out.meta);
      }
    }
  } catch (err) {
    return {
      action,
      agentRunId: null,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

function resultFromMeta(
  action: PlannedAction,
  meta: { agentRunId: string; status: string; cached: boolean },
): ActionResult {
  return {
    action,
    agentRunId: meta.agentRunId,
    status: meta.cached
      ? "cached"
      : (meta.status as "succeeded" | "failed" | "running"),
  };
}
