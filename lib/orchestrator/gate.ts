import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  attackFingerprints,
  briefs,
  incidents,
  reviewQueue,
  saifMappings,
  sourceRegistry,
} from "@/lib/db/schema";

/**
 * Governance gate (ADR 0005 D7). Pure code, deterministic tier table.
 * Called by the dispatcher after each successfully-executed stage to
 * route the produced artifact through one of four tiers:
 *
 *   auto-publish              — no row, no review, surfaces immediately
 *   auto-publish-with-audit   — row at status=approved (for the trail)
 *   approval-required         — row at status=pending (Phase 4 UI consumes)
 *   metrics-only              — no row, counted in eval scorecard
 *
 * Tier rules are hard-coded so changes land as code review + ADR
 * amendments; the table is the spec at ADR 0005 D7.
 */

export type GateTier =
  | "auto-publish"
  | "auto-publish-with-audit"
  | "approval-required"
  | "metrics-only";

export type GateSubjectKind =
  | "fingerprint"
  | "saif_mapping"
  | "brief"
  | "scenario"
  | "incident_tool_link";

export interface GateDecision {
  subjectKind: GateSubjectKind;
  subjectId: string;
  tier: GateTier;
  /** review_queue row id when one was written; otherwise null. */
  reviewQueueId: string | null;
  /** Free-text reason — surfaced on the ops page next to the row. */
  reason: string;
}

export const SAIF_MAPPING_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Route a freshly-extracted fingerprint based on its parent incident's
 * source trust. Official / verified sources auto-publish; community
 * sources require approval.
 */
export async function routeFingerprint(
  fingerprintId: string,
): Promise<GateDecision> {
  const [row] = await db
    .select({
      fpId: attackFingerprints.id,
      trust: sourceRegistry.trust,
    })
    .from(attackFingerprints)
    .innerJoin(incidents, eq(incidents.id, attackFingerprints.incidentId))
    .innerJoin(sourceRegistry, eq(sourceRegistry.id, incidents.sourceId))
    .where(eq(attackFingerprints.id, fingerprintId))
    .limit(1);

  if (!row) {
    return {
      subjectKind: "fingerprint",
      subjectId: fingerprintId,
      tier: "approval-required",
      reviewQueueId: await writeReviewQueueRow(
        "fingerprint",
        fingerprintId,
        "approval-required",
        "pending",
      ),
      reason: "fingerprint or parent source not found",
    };
  }

  if (row.trust === "official" || row.trust === "verified") {
    return {
      subjectKind: "fingerprint",
      subjectId: fingerprintId,
      tier: "auto-publish",
      reviewQueueId: null,
      reason: `parent source trust=${row.trust}`,
    };
  }

  // Community sources go through review.
  return {
    subjectKind: "fingerprint",
    subjectId: fingerprintId,
    tier: "approval-required",
    reviewQueueId: await writeReviewQueueRow(
      "fingerprint",
      fingerprintId,
      "approval-required",
      "pending",
    ),
    reason: `parent source trust=${row.trust}`,
  };
}

/**
 * Route a saif_mapping based on its confidence score. ≥ threshold →
 * audited auto-publish; below → approval-required.
 */
export async function routeMapping(
  mappingId: string,
): Promise<GateDecision> {
  const [row] = await db
    .select({
      id: saifMappings.id,
      confidence: saifMappings.confidence,
    })
    .from(saifMappings)
    .where(eq(saifMappings.id, mappingId))
    .limit(1);

  if (!row) {
    return {
      subjectKind: "saif_mapping",
      subjectId: mappingId,
      tier: "approval-required",
      reviewQueueId: await writeReviewQueueRow(
        "saif_mapping",
        mappingId,
        "approval-required",
        "pending",
      ),
      reason: "mapping not found",
    };
  }

  const conf = Number(row.confidence);
  if (conf >= SAIF_MAPPING_CONFIDENCE_THRESHOLD) {
    return {
      subjectKind: "saif_mapping",
      subjectId: mappingId,
      tier: "auto-publish-with-audit",
      reviewQueueId: await writeReviewQueueRow(
        "saif_mapping",
        mappingId,
        "auto-publish-with-audit",
        "approved",
      ),
      reason: `confidence ${conf.toFixed(2)} ≥ ${SAIF_MAPPING_CONFIDENCE_THRESHOLD}`,
    };
  }

  return {
    subjectKind: "saif_mapping",
    subjectId: mappingId,
    tier: "approval-required",
    reviewQueueId: await writeReviewQueueRow(
      "saif_mapping",
      mappingId,
      "approval-required",
      "pending",
    ),
    reason: `confidence ${conf.toFixed(2)} < ${SAIF_MAPPING_CONFIDENCE_THRESHOLD}`,
  };
}

/** Briefs always go auto-publish-with-audit — they compose, not analyze (CRITIQUE C2). */
export async function routeBrief(briefId: string): Promise<GateDecision> {
  const [row] = await db
    .select({ id: briefs.id })
    .from(briefs)
    .where(eq(briefs.id, briefId))
    .limit(1);

  if (!row) {
    return {
      subjectKind: "brief",
      subjectId: briefId,
      tier: "approval-required",
      reviewQueueId: await writeReviewQueueRow(
        "brief",
        briefId,
        "approval-required",
        "pending",
      ),
      reason: "brief not found",
    };
  }
  return {
    subjectKind: "brief",
    subjectId: briefId,
    tier: "auto-publish-with-audit",
    reviewQueueId: await writeReviewQueueRow(
      "brief",
      briefId,
      "auto-publish-with-audit",
      "approved",
    ),
    reason: "briefs always auto-publish-with-audit",
  };
}

/**
 * Route a scenario based on origin. Operator-initiated synthesis
 * (the only path in v1) gets audited auto-publish; the orchestrator-
 * initiated path isn't dispatched in v1 but is reserved here so the
 * Phase 4 Review Queue UI inherits a complete tier spec.
 */
export async function routeScenario(
  scenarioId: string,
  origin: "operator" | "orchestrator",
): Promise<GateDecision> {
  if (origin === "operator") {
    return {
      subjectKind: "scenario",
      subjectId: scenarioId,
      tier: "auto-publish-with-audit",
      reviewQueueId: await writeReviewQueueRow(
        "scenario",
        scenarioId,
        "auto-publish-with-audit",
        "approved",
      ),
      reason: "scenario synthesized from operator UI",
    };
  }
  return {
    subjectKind: "scenario",
    subjectId: scenarioId,
    tier: "approval-required",
    reviewQueueId: await writeReviewQueueRow(
      "scenario",
      scenarioId,
      "approval-required",
      "pending",
    ),
    reason: "scenario synthesized autonomously by orchestrator",
  };
}

/**
 * Route an incident-tool link. Capability links are advisory only
 * (metrics-only, no row); attribution links auto-publish without
 * review. Either way, no queue write — included for completeness with
 * the tier table.
 */
export function routeIncidentToolLink(
  linkId: string,
  matchType: "capability" | "attribution",
): GateDecision {
  if (matchType === "attribution") {
    return {
      subjectKind: "incident_tool_link",
      subjectId: linkId,
      tier: "auto-publish",
      reviewQueueId: null,
      reason: "attribution-grade link",
    };
  }
  return {
    subjectKind: "incident_tool_link",
    subjectId: linkId,
    tier: "metrics-only",
    reviewQueueId: null,
    reason: "capability link — advisory only",
  };
}

async function writeReviewQueueRow(
  subjectKind: GateSubjectKind,
  subjectId: string,
  tier: GateTier,
  status: "pending" | "approved" | "rejected",
): Promise<string> {
  const [row] = await db
    .insert(reviewQueue)
    .values({ subjectKind, subjectId, tier, status })
    .returning({ id: reviewQueue.id });
  return row.id;
}
