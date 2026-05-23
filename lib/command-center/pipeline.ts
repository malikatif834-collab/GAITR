/**
 * The six pipeline stages (ADR 0003 D1). Pure reference data — imported by
 * the Command Center's river on the client and by stage tooling on the
 * server. `synthesize` is live today as the Alchemy Engine (ADR 0002); the
 * other five land as typed jobs in Phase 2.
 */

export type StageId =
  | "ingest"
  | "extract"
  | "correlate"
  | "synthesize"
  | "map"
  | "report";

export type StageStatus = "live" | "planned";

export interface PipelineStage {
  id: StageId;
  order: number;
  label: string;
  /** Short subtitle shown on the river node. */
  blurb: string;
  /** Full description shown in the drill-in panel. */
  detail: string;
  /** Human label for the stage's compute model. */
  compute: string;
  /** Whether the stage ever calls an LLM (ADR 0003 D1). */
  isLlm: boolean;
  /** The spec-era agent(s) this stage replaces (ADR 0003 D1). */
  replaces: string;
  /** Lifecycle intent. All six stages are "live" as of Phase 2 slice 4. */
  status: StageStatus;
  /** ADR that shipped the stage. */
  phase: string;
  /** Domain noun for the stage's output (used in metric labels). */
  outputNoun: string;
}

export const STAGES: PipelineStage[] = [
  {
    id: "ingest",
    order: 1,
    label: "Ingest",
    blurb: "Fetches and parses raw intelligence.",
    detail:
      "Pulls and parses raw records from the governed source registry — feeds, advisories, research. Deterministic fetch-and-parse with no model call; live ingestion is gated behind a security review in Phase 5.",
    compute: "Deterministic",
    isLlm: false,
    replaces: "Monitor Agent + Threat Intel Collector",
    status: "live",
    phase: "Live · Phase 2",
    outputNoun: "events",
  },
  {
    id: "extract",
    order: 2,
    label: "Extract",
    blurb: "Lifts attack fingerprints and tool profiles.",
    detail:
      "A single schema-constrained model call that extracts attack fingerprints and AI-tool profiles out of ingested records, tagged with MITRE ATLAS / ATT&CK identifiers.",
    compute: "LLM · single call",
    isLlm: true,
    replaces: "Curator + Fingerprint Archivist",
    status: "live",
    phase: "Live · Phase 2",
    outputNoun: "fingerprints",
  },
  {
    id: "correlate",
    order: 3,
    label: "Correlate",
    blurb: "Links incidents to AI tools.",
    detail:
      "Matches incidents to AI tools by capability and by attribution using embeddings; the model is consulted only to break ambiguous ties. Only attribution-grade links feed risk scores.",
    compute: "Embeddings · LLM tiebreaks",
    isLlm: true,
    replaces: "Incident Correlator",
    status: "live",
    phase: "Live · Phase 2",
    outputNoun: "links",
  },
  {
    id: "synthesize",
    order: 4,
    label: "Synthesize",
    blurb: "Composes emergent multi-tool scenarios.",
    detail:
      "The one genuinely multi-step agentic call. A deterministic matcher fires known capability synergies, then the synthesizer composes a SAIF-mapped threat scenario with full decision-record provenance. Live today as the Alchemy Engine.",
    compute: "LLM · multi-step",
    isLlm: true,
    replaces: "Scenario Synthesizer",
    status: "live",
    phase: "Live · ADR 0002",
    outputNoun: "scenarios",
  },
  {
    id: "map",
    order: 5,
    label: "Map",
    blurb: "Maps threats to SAIF controls.",
    detail:
      "A single constrained call that maps a synthesized threat onto specific SAIF controls and scores its novelty, grounded by retrieval over the SAIF corpus.",
    compute: "LLM · single call",
    isLlm: true,
    replaces: "Analyst Agent",
    status: "live",
    phase: "Live · Phase 2",
    outputNoun: "mappings",
  },
  {
    id: "report",
    order: 6,
    label: "Report",
    blurb: "Composes analyst-ready briefs.",
    detail:
      "A single composition call that writes the human-facing brief over data that is already mapped and scored — narrative only, no new analysis.",
    compute: "LLM · single call",
    isLlm: true,
    replaces: "Reporter Agent",
    status: "live",
    phase: "Live · Phase 2",
    outputNoun: "briefs",
  },
];
