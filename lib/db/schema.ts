import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  numeric,
  integer,
  boolean,
  unique,
} from "drizzle-orm/pg-core";

/**
 * AI tool catalog. Capabilities reference the closed vocabulary in
 * `./capabilities.ts`. `source_trust` distinguishes hand-curated seed
 * entries from later ingested ones — see CRITIQUE.md A3 (catalog poisoning).
 *
 * v0.2 will add an `embedding vector(1536)` column for novelty scoring.
 */
export const aiTools = pgTable("ai_tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  vendor: text("vendor"),
  url: text("url"),
  description: text("description"),
  capabilities: text("capabilities").array().notNull(),
  sourceTrust: text("source_trust").notNull().default("seed"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Synergy pattern library. AND semantics on `requiredCapabilities`: a
 * pattern matches a tool set iff every required capability is present
 * across the union of the selected tools' capabilities.
 */
export const capabilitySynergies = pgTable("capability_synergies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  requiredCapabilities: text("required_capabilities").array().notNull(),
  emergentThreat: text("emergent_threat").notNull(),
  riskMultiplier: numeric("risk_multiplier", {
    precision: 3,
    scale: 2,
  }).notNull(),
  saifControls: text("saif_controls").array().notNull(),
  rationale: text("rationale").notNull(),
  source: text("source").notNull().default("curated"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Decision record: the reproducibility tuple for every AI-driven output.
 * Closes CRITIQUE.md B1 — every scenario references one of these so the
 * decision can be replayed months later with the same prompt + model.
 */
export const decisionRecords = pgTable("decision_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentName: text("agent_name").notNull(),
  promptVersion: text("prompt_version").notNull(),
  modelId: text("model_id").notNull(),
  modelParams: jsonb("model_params").notNull(),
  inputHash: text("input_hash").notNull(),
  outputHash: text("output_hash").notNull(),
  retrievalSources: jsonb("retrieval_sources"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * A synthesized threat scenario. Always linked to a decision record;
 * inserted in the same transaction.
 */
export const alchemyScenarios = pgTable("alchemy_scenarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  toolIds: uuid("tool_ids").array().notNull(),
  matchedPatternIds: uuid("matched_pattern_ids").array().notNull(),
  narrative: text("narrative").notNull(),
  emergentCapabilities: text("emergent_capabilities").array().notNull(),
  mitigations: jsonb("mitigations").notNull(),
  saifControls: text("saif_controls").array().notNull(),
  confidence: numeric("confidence", { precision: 3, scale: 2 }).notNull(),
  decisionRecordId: uuid("decision_record_id")
    .notNull()
    .references(() => decisionRecords.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Pending synergy proposals queue. v0.1 ships the table; the review UI
 * lands in v0.2. Auto-discovered patterns will land here for human
 * approval before being promoted into `capability_synergies`.
 */
export const pendingSynergyProposals = pgTable("pending_synergy_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposedSynergy: jsonb("proposed_synergy").notNull(),
  status: text("status").notNull().default("pending"),
  reviewerNotes: text("reviewer_notes"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ----------------------------------------------------------------------
   Phase 2 — data model for the pipeline backend (ADR 0003 D1 + ADR 0004).
   Tables below are the typed schema for the six stages plus the
   cross-cutting governance / RBAC / eval surfaces.
   ---------------------------------------------------------------------- */

/**
 * Real-world AI security incidents. The `ingest` stage writes here from
 * registered sources; Phase 2 ships a hand-curated starter set. Live
 * ingestion is deferred to Phase 5 behind /security-review.
 */
export const sourceRegistry = pgTable("source_registry", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  /** "advisory" | "research" | "news" | "framework" | "vendor" */
  kind: text("kind").notNull(),
  /** "official" | "verified" | "community" — drives source_trust on events. */
  trust: text("trust").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  narrative: text("narrative"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  /** "critical" | "high" | "medium" | "low" — Okabe-Ito severity ramp. */
  severity: text("severity").notNull(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sourceRegistry.id),
  sourceUrl: text("source_url"),
  tags: text("tags").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Incident → AI-tool link. `match_type` distinguishes a capability fit
 * ("this tool could have done this") from an attribution-grade link
 * ("this tool was used"); only attribution feeds risk scores
 * (CRITIQUE F3).
 */
export const incidentToolLinks = pgTable("incident_tool_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id")
    .notNull()
    .references(() => incidents.id),
  toolId: uuid("tool_id")
    .notNull()
    .references(() => aiTools.id),
  /** "capability" | "attribution" */
  matchType: text("match_type").notNull(),
  confidence: numeric("confidence", { precision: 3, scale: 2 }).notNull(),
  rationale: text("rationale"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Attack fingerprint — the structured signature extracted from an
 * incident (the `extract` stage output). Tagged with MITRE ATLAS +
 * ATT&CK ids for interoperability (CRITIQUE D3).
 */
export const attackFingerprints = pgTable("attack_fingerprints", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id")
    .notNull()
    .references(() => incidents.id),
  name: text("name").notNull(),
  description: text("description"),
  mitreAtlasIds: text("mitre_atlas_ids").array().notNull(),
  mitreAttackIds: text("mitre_attack_ids").array().notNull(),
  capabilities: text("capabilities").array().notNull(),
  decisionRecordId: uuid("decision_record_id")
    .notNull()
    .references(() => decisionRecords.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * SAIF reference corpus — Google's Secure AI Framework. Six control
 * categories × N risk categories, seeded from `docs/spec/extracted.md`.
 * `map` grounds against this via retrieval.
 */
export const saifControls = pgTable(
  "saif_controls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** SaifControl enum: "D" | "I" | "M" | "A" | "AS" | "G". */
    category: text("category").notNull(),
    /** Short identifier within category, e.g. "D1", "AS3". */
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    riskCategories: text("risk_categories").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("saif_controls_category_code_uq").on(t.category, t.code)],
);

/**
 * `map` stage output — a threat (scenario / fingerprint / incident)
 * mapped onto a specific SAIF control with confidence and decision
 * record. Polymorphic subject — FK left at the app layer.
 */
export const saifMappings = pgTable("saif_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** "scenario" | "fingerprint" | "incident" */
  subjectKind: text("subject_kind").notNull(),
  subjectId: uuid("subject_id").notNull(),
  saifControlId: uuid("saif_control_id")
    .notNull()
    .references(() => saifControls.id),
  confidence: numeric("confidence", { precision: 3, scale: 2 }).notNull(),
  rationale: text("rationale"),
  decisionRecordId: uuid("decision_record_id")
    .notNull()
    .references(() => decisionRecords.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Raw ingest record — the parsed/sanitized payload from a source plus
 * the sanitization flags applied (prompt-injection filter, URL
 * stripping, etc. per CRITIQUE A1 / A3). Idempotent on
 * (source_id, external_ref).
 */
export const ingestionEvents = pgTable(
  "ingestion_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sourceRegistry.id),
    externalRef: text("external_ref").notNull(),
    payload: jsonb("payload").notNull(),
    sourceTrust: text("source_trust").notNull(),
    sanitizationFlags: text("sanitization_flags").array().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("ingestion_events_source_ref_uq").on(t.sourceId, t.externalRef),
  ],
);

/**
 * Stage / orchestrator execution log. Every stage run writes one row,
 * keyed by (stage_id, idempotency_key) so retries are no-ops
 * (CRITIQUE E2).
 */
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** "ingest" | "extract" | "correlate" | "synthesize" | "map" | "report" */
    stageId: text("stage_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    /** "succeeded" | "failed" | "running" | "skipped" */
    status: text("status").notNull(),
    inputHash: text("input_hash").notNull(),
    /** Stored input payload (jsonb), used by the ops replay endpoint to
     *  re-dispatch the same work. Nullable for rows created before this
     *  column existed (migration 0002). */
    input: jsonb("input"),
    outputHash: text("output_hash"),
    decisionRecordId: uuid("decision_record_id").references(
      () => decisionRecords.id,
    ),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [unique("agent_runs_stage_key_uq").on(t.stageId, t.idempotencyKey)],
);

/**
 * Governance-gate queue. Items that need human review before reaching
 * the published catalog. `tier` carries the action-truthful routing
 * decision (CRITIQUE C4 renames).
 */
export const reviewQueue = pgTable("review_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectKind: text("subject_kind").notNull(),
  subjectId: uuid("subject_id").notNull(),
  /** auto-publish | auto-publish-with-audit | approval-required | metrics-only */
  tier: text("tier").notNull(),
  /** "pending" | "approved" | "rejected" */
  status: text("status").notNull().default("pending"),
  reviewerId: uuid("reviewer_id"),
  decisionNotes: text("decision_notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

/**
 * Human correction events — closes the loop from reviewers' edits back
 * into prompt versions / eval datasets (CRITIQUE G1).
 */
export const feedbackEvents = pgTable("feedback_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectKind: text("subject_kind").notNull(),
  subjectId: uuid("subject_id").notNull(),
  /** "correction" | "approval" | "rejection" */
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull(),
  userId: uuid("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Per-stage scorecard metrics (CRITIQUE G2). Read-only; written by the
 * eval harness (Phase 5 closes the loop). Phase 2 ships only the table.
 */
export const evalResults = pgTable("eval_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  stageId: text("stage_id").notNull(),
  metric: text("metric").notNull(),
  value: numeric("value", { precision: 10, scale: 4 }).notNull(),
  sampleSize: integer("sample_size"),
  windowStart: timestamp("window_start", { withTimezone: true }),
  windowEnd: timestamp("window_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * RBAC users — Analyst / Reviewer / Admin / Auditor (CRITIQUE H1).
 * Phase 2 ships the table; enforcement lands in Phase 5.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  /** "analyst" | "reviewer" | "admin" | "auditor" */
  role: text("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * `report` stage output — the analyst-facing brief composed over
 * already-mapped + scored data (CRITIQUE C2).
 */
export const briefs = pgTable("briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  subjectKind: text("subject_kind").notNull(),
  subjectId: uuid("subject_id").notNull(),
  decisionRecordId: uuid("decision_record_id")
    .notNull()
    .references(() => decisionRecords.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AiTool = typeof aiTools.$inferSelect;
export type NewAiTool = typeof aiTools.$inferInsert;
export type CapabilitySynergy = typeof capabilitySynergies.$inferSelect;
export type NewCapabilitySynergy = typeof capabilitySynergies.$inferInsert;
export type DecisionRecord = typeof decisionRecords.$inferSelect;
export type NewDecisionRecord = typeof decisionRecords.$inferInsert;
export type AlchemyScenario = typeof alchemyScenarios.$inferSelect;
export type NewAlchemyScenario = typeof alchemyScenarios.$inferInsert;

export type SourceRegistry = typeof sourceRegistry.$inferSelect;
export type NewSourceRegistry = typeof sourceRegistry.$inferInsert;
export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
export type IncidentToolLink = typeof incidentToolLinks.$inferSelect;
export type NewIncidentToolLink = typeof incidentToolLinks.$inferInsert;
export type AttackFingerprint = typeof attackFingerprints.$inferSelect;
export type NewAttackFingerprint = typeof attackFingerprints.$inferInsert;
export type SaifControlRow = typeof saifControls.$inferSelect;
export type NewSaifControlRow = typeof saifControls.$inferInsert;
export type SaifMapping = typeof saifMappings.$inferSelect;
export type NewSaifMapping = typeof saifMappings.$inferInsert;
export type IngestionEvent = typeof ingestionEvents.$inferSelect;
export type NewIngestionEvent = typeof ingestionEvents.$inferInsert;
export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
export type ReviewQueueItem = typeof reviewQueue.$inferSelect;
export type NewReviewQueueItem = typeof reviewQueue.$inferInsert;
export type FeedbackEvent = typeof feedbackEvents.$inferSelect;
export type NewFeedbackEvent = typeof feedbackEvents.$inferInsert;
export type EvalResult = typeof evalResults.$inferSelect;
export type NewEvalResult = typeof evalResults.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Brief = typeof briefs.$inferSelect;
export type NewBrief = typeof briefs.$inferInsert;
