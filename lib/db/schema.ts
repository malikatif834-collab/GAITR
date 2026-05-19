import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  numeric,
  integer,
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

export type AiTool = typeof aiTools.$inferSelect;
export type NewAiTool = typeof aiTools.$inferInsert;
export type CapabilitySynergy = typeof capabilitySynergies.$inferSelect;
export type NewCapabilitySynergy = typeof capabilitySynergies.$inferInsert;
export type DecisionRecord = typeof decisionRecords.$inferSelect;
export type NewDecisionRecord = typeof decisionRecords.$inferInsert;
export type AlchemyScenario = typeof alchemyScenarios.$inferSelect;
export type NewAlchemyScenario = typeof alchemyScenarios.$inferInsert;
