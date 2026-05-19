import { z } from "zod";
import { CAPABILITIES, SAIF_CONTROLS } from "@/lib/db/capabilities";
import type {
  AiTool,
  CapabilitySynergy,
  DecisionRecord,
  AlchemyScenario,
} from "@/lib/db/schema";
import type { MatchedPattern } from "./match";

export const SaifControlEnum = z.enum(SAIF_CONTROLS);
export const CapabilityEnum = z.enum(CAPABILITIES);

export const MitigationSchema = z.object({
  control: SaifControlEnum,
  action: z.string().min(1).max(500),
  rationale: z.string().min(1).max(500),
});

export const SynthesizedScenarioSchema = z.object({
  narrative: z.string().min(40).max(2000),
  emergentCapabilities: z.array(z.string().min(1).max(200)).min(1).max(10),
  mitigations: z.array(MitigationSchema).min(1).max(10),
  saifControls: z.array(SaifControlEnum).min(1),
  confidence: z.number().min(0).max(1),
});

export type SynthesizedScenario = z.infer<typeof SynthesizedScenarioSchema>;
export type Mitigation = z.infer<typeof MitigationSchema>;

export const SynthesizeRequestSchema = z.object({
  toolIds: z.array(z.uuid()).min(1).max(8),
});

export type SynthesizeRequest = z.infer<typeof SynthesizeRequestSchema>;

/**
 * Input handed to a provider. Tools and matched patterns are full DB rows
 * so the provider can attribute capabilities and rationale without
 * additional lookups.
 */
export interface SynthesisInput {
  tools: AiTool[];
  matched: MatchedPattern<CapabilitySynergy, AiTool>[];
}

/**
 * Provider output. Decision-record fields are populated by the provider
 * (model + token counts + provenance); the orchestrator fills in
 * inputHash/outputHash and persists.
 */
export interface ProviderResult {
  scenario: SynthesizedScenario;
  modelId: string;
  modelParams: Record<string, unknown>;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export interface SynthesisResult {
  scenario: AlchemyScenario;
  decision: DecisionRecord;
  matched: MatchedPattern<CapabilitySynergy, AiTool>[];
}
