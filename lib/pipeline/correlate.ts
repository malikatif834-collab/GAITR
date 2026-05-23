import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  aiTools,
  attackFingerprints,
  incidentToolLinks,
} from "@/lib/db/schema";
import { runStage, type RunStageOpts } from "./run";
import type { StageOutput } from "./types";

/**
 * The `correlate` stage. Phase 2 ships the capability-match path:
 * for each fingerprint of an incident, find AI tools whose capabilities
 * overlap and emit `incident_tool_links` rows that don't already exist.
 *
 * Attribution-grade links stay seeded by hand (slice 3); the
 * embeddings-based attribution heuristic lands in a later phase.
 */

export interface CorrelateOutput {
  linksAdded: number;
  toolIds: string[];
}

interface CandidateInput {
  toolCapabilities: readonly string[];
  fingerprintCapabilities: readonly string[];
}

/** Pure scoring helper — number of fingerprint caps the tool covers. */
export function overlapCount(input: CandidateInput): number {
  const caps = new Set(input.fingerprintCapabilities);
  return input.toolCapabilities.filter((c) => caps.has(c)).length;
}

/** Pure confidence scorer — used by tests + the live stage. */
export function capabilityConfidence(overlap: number): number {
  if (overlap <= 0) return 0;
  return Math.min(0.5 + 0.1 * overlap, 0.85);
}

export async function correlateIncident(
  incidentId: string,
  opts: RunStageOpts = {},
): Promise<StageOutput<CorrelateOutput>> {
  return runStage("correlate", { incidentId }, async () => {
    const fingerprints = await db
      .select()
      .from(attackFingerprints)
      .where(eq(attackFingerprints.incidentId, incidentId));

    if (fingerprints.length === 0) {
      const output: CorrelateOutput = { linksAdded: 0, toolIds: [] };
      return { output, outputHashable: output };
    }

    const fingerprintCaps = Array.from(
      new Set(fingerprints.flatMap((f) => f.capabilities)),
    );

    const existing = await db
      .select({ toolId: incidentToolLinks.toolId })
      .from(incidentToolLinks)
      .where(eq(incidentToolLinks.incidentId, incidentId));
    const existingToolIds = new Set(existing.map((e) => e.toolId));

    const allTools = await db.select().from(aiTools);

    const newLinks = allTools
      .filter((t) => !existingToolIds.has(t.id))
      .map((t) => {
        const overlap = overlapCount({
          toolCapabilities: t.capabilities,
          fingerprintCapabilities: fingerprintCaps,
        });
        return { tool: t, overlap };
      })
      .filter(({ overlap }) => overlap > 0)
      .map(({ tool, overlap }) => ({
        incidentId,
        toolId: tool.id,
        matchType: "capability" as const,
        confidence: capabilityConfidence(overlap).toFixed(2),
        rationale: `Capability match (overlap ${overlap}): ${tool.capabilities.filter((c) => fingerprintCaps.includes(c)).join(", ")}.`,
      }));

    if (newLinks.length > 0) {
      await db.insert(incidentToolLinks).values(newLinks);
    }

    const output: CorrelateOutput = {
      linksAdded: newLinks.length,
      toolIds: newLinks.map((l) => l.toolId),
    };
    return { output, outputHashable: output };
  }, opts);
}
