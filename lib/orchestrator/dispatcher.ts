import { ingestSource } from "@/lib/pipeline/ingest";
import { extractFromIncident } from "@/lib/pipeline/extract";
import { correlateIncident } from "@/lib/pipeline/correlate";
import { mapSubject } from "@/lib/pipeline/map";
import { composeBrief } from "@/lib/pipeline/report";
import {
  routeBrief,
  routeFingerprint,
  routeMapping,
  type GateDecision,
} from "./gate";
import type { ActionResult, PlannedAction } from "./types";

/**
 * Dispatch a planned action via the appropriate stage function, then —
 * for newly-executed actions only (cached results skip) — route the
 * produced artifacts through the governance gate. Errors are caught
 * so one stage failure doesn't blow up the tick; runStage's atomic
 * failed→running reclaim handles retry on the next planner pass.
 */
export interface DispatchedAction extends ActionResult {
  gateDecisions: GateDecision[];
}

export async function dispatchAction(
  action: PlannedAction,
): Promise<DispatchedAction> {
  try {
    switch (action.kind) {
      case "ingest": {
        const out = await ingestSource(action.sourceId);
        return {
          ...resultFromMeta(action, out.meta),
          gateDecisions: [],
        };
      }
      case "extract": {
        const out = await extractFromIncident(action.incidentId);
        const result = resultFromMeta(action, out.meta);
        const gateDecisions: GateDecision[] = [];
        if (result.status === "succeeded" && out.output?.fingerprintId) {
          gateDecisions.push(await routeFingerprint(out.output.fingerprintId));
        }
        return { ...result, gateDecisions };
      }
      case "correlate": {
        const out = await correlateIncident(action.incidentId);
        // Capability links are metrics-only — no gate row to write;
        // they're counted via the eval scorecard instead.
        return { ...resultFromMeta(action, out.meta), gateDecisions: [] };
      }
      case "map": {
        const out = await mapSubject(action.subject);
        const result = resultFromMeta(action, out.meta);
        const gateDecisions: GateDecision[] = [];
        if (result.status === "succeeded" && out.output?.mappingIds) {
          for (const id of out.output.mappingIds) {
            gateDecisions.push(await routeMapping(id));
          }
        }
        return { ...result, gateDecisions };
      }
      case "report": {
        const out = await composeBrief(action.subject);
        const result = resultFromMeta(action, out.meta);
        const gateDecisions: GateDecision[] = [];
        if (result.status === "succeeded" && out.output?.briefId) {
          gateDecisions.push(await routeBrief(out.output.briefId));
        }
        return { ...result, gateDecisions };
      }
    }
  } catch (err) {
    return {
      action,
      agentRunId: null,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
      gateDecisions: [],
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
