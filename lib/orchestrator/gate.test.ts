import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  attackFingerprints,
  briefs,
  decisionRecords,
  incidents,
  reviewQueue,
  saifControls,
  saifMappings,
  sourceRegistry,
} from "@/lib/db/schema";
import {
  routeBrief,
  routeFingerprint,
  routeIncidentToolLink,
  routeMapping,
  routeScenario,
  SAIF_MAPPING_CONFIDENCE_THRESHOLD,
} from "./gate";

/* Tier-table coverage for the governance gate. DB-touching; skips when
   DATABASE_URL is unset. Sets up minimal scaffolding (decision_records,
   source_registry rows) inline and cleans them up in afterAll. */

const HAS_DB = !!process.env.DATABASE_URL;
const d = HAS_DB ? describe : describe.skip;

const created = {
  sources: [] as string[],
  decisions: [] as string[],
  incidents: [] as string[],
  fingerprints: [] as string[],
  controls: [] as string[],
  mappings: [] as string[],
  briefs: [] as string[],
  reviewQueueIds: [] as string[],
};

async function makeDecision(): Promise<string> {
  const [row] = await db
    .insert(decisionRecords)
    .values({
      agentName: "gate-test",
      promptVersion: "test@v1",
      modelId: "test",
      modelParams: {},
      inputHash: "test",
      outputHash: "test",
      promptTokens: 0,
      completionTokens: 0,
      costUsd: "0.000000",
    })
    .returning({ id: decisionRecords.id });
  created.decisions.push(row.id);
  return row.id;
}

async function makeSource(trust: "official" | "verified" | "community") {
  const [row] = await db
    .insert(sourceRegistry)
    .values({
      name: `gate-test-${trust}-${Date.now()}-${Math.random()}`,
      url: `https://example.test/${trust}`,
      kind: "framework",
      trust,
      enabled: true,
    })
    .returning({ id: sourceRegistry.id });
  created.sources.push(row.id);
  return row.id;
}

async function makeIncidentForSource(sourceId: string) {
  const [row] = await db
    .insert(incidents)
    .values({
      title: "gate-test incident",
      summary: "summary",
      severity: "low",
      sourceId,
      tags: [],
    })
    .returning({ id: incidents.id });
  created.incidents.push(row.id);
  return row.id;
}

async function makeFingerprintForIncident(incidentId: string) {
  const decisionId = await makeDecision();
  const [row] = await db
    .insert(attackFingerprints)
    .values({
      incidentId,
      name: "fp",
      mitreAtlasIds: [],
      mitreAttackIds: [],
      capabilities: [],
      decisionRecordId: decisionId,
    })
    .returning({ id: attackFingerprints.id });
  created.fingerprints.push(row.id);
  return row.id;
}

async function makeMapping(confidence: number) {
  const decisionId = await makeDecision();
  const [control] =
    (await db.select().from(saifControls).limit(1)) ?? ([] as never[]);
  if (!control) {
    const [c] = await db
      .insert(saifControls)
      .values({
        category: "G",
        code: `GT${Date.now()}`,
        title: "Gate test control",
        description: "test",
        riskCategories: ["test"],
      })
      .returning({ id: saifControls.id });
    created.controls.push(c.id);
    var controlId = c.id; // eslint-disable-line no-var
  } else {
    var controlId = control.id; // eslint-disable-line no-var
  }
  const [row] = await db
    .insert(saifMappings)
    .values({
      subjectKind: "scenario",
      subjectId: crypto.randomUUID(),
      saifControlId: controlId,
      confidence: confidence.toFixed(2),
      decisionRecordId: decisionId,
    })
    .returning({ id: saifMappings.id });
  created.mappings.push(row.id);
  return row.id;
}

async function makeBrief() {
  const decisionId = await makeDecision();
  const [row] = await db
    .insert(briefs)
    .values({
      title: "gate-test brief",
      body: "body",
      subjectKind: "scenario",
      subjectId: crypto.randomUUID(),
      decisionRecordId: decisionId,
    })
    .returning({ id: briefs.id });
  created.briefs.push(row.id);
  return row.id;
}

d("orchestrator/gate — tier table", () => {
  afterAll(async () => {
    if (created.reviewQueueIds.length) {
      await db
        .delete(reviewQueue)
        .where(inArray(reviewQueue.id, created.reviewQueueIds))
        .catch(() => undefined);
    }
    if (created.briefs.length) {
      await db
        .delete(briefs)
        .where(inArray(briefs.id, created.briefs))
        .catch(() => undefined);
    }
    if (created.mappings.length) {
      await db
        .delete(saifMappings)
        .where(inArray(saifMappings.id, created.mappings))
        .catch(() => undefined);
    }
    if (created.fingerprints.length) {
      await db
        .delete(attackFingerprints)
        .where(inArray(attackFingerprints.id, created.fingerprints))
        .catch(() => undefined);
    }
    if (created.incidents.length) {
      await db
        .delete(incidents)
        .where(inArray(incidents.id, created.incidents))
        .catch(() => undefined);
    }
    if (created.controls.length) {
      await db
        .delete(saifControls)
        .where(inArray(saifControls.id, created.controls))
        .catch(() => undefined);
    }
    if (created.sources.length) {
      await db
        .delete(sourceRegistry)
        .where(inArray(sourceRegistry.id, created.sources))
        .catch(() => undefined);
    }
    if (created.decisions.length) {
      await db
        .delete(decisionRecords)
        .where(inArray(decisionRecords.id, created.decisions))
        .catch(() => undefined);
    }
  });

  it("fingerprint from official source → auto-publish, no queue row", async () => {
    const src = await makeSource("official");
    const inc = await makeIncidentForSource(src);
    const fp = await makeFingerprintForIncident(inc);
    const decision = await routeFingerprint(fp);
    expect(decision.tier).toBe("auto-publish");
    expect(decision.reviewQueueId).toBeNull();
  });

  it("fingerprint from verified source → auto-publish, no queue row", async () => {
    const src = await makeSource("verified");
    const inc = await makeIncidentForSource(src);
    const fp = await makeFingerprintForIncident(inc);
    const decision = await routeFingerprint(fp);
    expect(decision.tier).toBe("auto-publish");
    expect(decision.reviewQueueId).toBeNull();
  });

  it("fingerprint from community source → approval-required + queue row", async () => {
    const src = await makeSource("community");
    const inc = await makeIncidentForSource(src);
    const fp = await makeFingerprintForIncident(inc);
    const decision = await routeFingerprint(fp);
    expect(decision.tier).toBe("approval-required");
    expect(decision.reviewQueueId).not.toBeNull();
    if (decision.reviewQueueId) created.reviewQueueIds.push(decision.reviewQueueId);
  });

  it("saif_mapping above threshold → auto-publish-with-audit + audit row", async () => {
    const m = await makeMapping(SAIF_MAPPING_CONFIDENCE_THRESHOLD + 0.05);
    const decision = await routeMapping(m);
    expect(decision.tier).toBe("auto-publish-with-audit");
    expect(decision.reviewQueueId).not.toBeNull();
    if (decision.reviewQueueId) created.reviewQueueIds.push(decision.reviewQueueId);
  });

  it("saif_mapping below threshold → approval-required + queue row", async () => {
    const m = await makeMapping(SAIF_MAPPING_CONFIDENCE_THRESHOLD - 0.05);
    const decision = await routeMapping(m);
    expect(decision.tier).toBe("approval-required");
    expect(decision.reviewQueueId).not.toBeNull();
    if (decision.reviewQueueId) created.reviewQueueIds.push(decision.reviewQueueId);
  });

  it("brief always → auto-publish-with-audit + audit row", async () => {
    const b = await makeBrief();
    const decision = await routeBrief(b);
    expect(decision.tier).toBe("auto-publish-with-audit");
    expect(decision.reviewQueueId).not.toBeNull();
    if (decision.reviewQueueId) created.reviewQueueIds.push(decision.reviewQueueId);
  });

  it("scenario from operator → auto-publish-with-audit + audit row", async () => {
    const decision = await routeScenario(crypto.randomUUID(), "operator");
    expect(decision.tier).toBe("auto-publish-with-audit");
    expect(decision.reviewQueueId).not.toBeNull();
    if (decision.reviewQueueId) created.reviewQueueIds.push(decision.reviewQueueId);
  });

  it("scenario from orchestrator (not v1) → approval-required + queue row", async () => {
    const decision = await routeScenario(crypto.randomUUID(), "orchestrator");
    expect(decision.tier).toBe("approval-required");
    expect(decision.reviewQueueId).not.toBeNull();
    if (decision.reviewQueueId) created.reviewQueueIds.push(decision.reviewQueueId);
  });

  it("incident_tool_link by match_type — pure decision, no queue write", () => {
    expect(routeIncidentToolLink("x", "capability").tier).toBe("metrics-only");
    expect(routeIncidentToolLink("x", "capability").reviewQueueId).toBeNull();
    expect(routeIncidentToolLink("y", "attribution").tier).toBe("auto-publish");
    expect(routeIncidentToolLink("y", "attribution").reviewQueueId).toBeNull();
  });
});
