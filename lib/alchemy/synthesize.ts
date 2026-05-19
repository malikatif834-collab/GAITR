import { inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  aiTools,
  alchemyScenarios,
  capabilitySynergies,
  decisionRecords,
} from "@/lib/db/schema";
import type { AiTool, CapabilitySynergy } from "@/lib/db/schema";
import { matchSynergies } from "./match";
import { callProvider, resolveProvider } from "./providers";
import { canonicalHash } from "./hash";
import { PROMPT_VERSION } from "./prompts/scene-synth.v1";
import { SynthesizedScenarioSchema, type SynthesisResult } from "./types";

const AGENT_NAME = "scenario-synthesizer";

/**
 * The orchestrator. Loads tools by id, runs the deterministic matcher,
 * calls the configured provider for the LLM step, validates the output,
 * and persists the decision record + scenario in a single transaction.
 *
 * Every persisted scenario carries an FK to a decision_record that
 * captures (promptVersion, modelId, modelParams, inputHash, outputHash,
 * tokens, cost). This is the audit tuple that closes CRITIQUE.md B1.
 */
export async function synthesizeScenario(
  toolIds: string[],
): Promise<SynthesisResult> {
  if (toolIds.length === 0) {
    throw new Error("synthesizeScenario requires at least one tool id.");
  }

  const tools: AiTool[] = await db
    .select()
    .from(aiTools)
    .where(inArray(aiTools.id, toolIds));

  if (tools.length === 0) {
    throw new Error("No tools matched the provided ids.");
  }

  const patterns: CapabilitySynergy[] = await db.select().from(capabilitySynergies);

  const matched = matchSynergies(tools, patterns);

  const providerResult = await callProvider({ tools, matched });

  // Re-validate at the orchestrator boundary even though the provider already
  // parsed — defense in depth, and it keeps the stub honest.
  const scenarioPayload = SynthesizedScenarioSchema.parse(providerResult.scenario);

  const inputHash = canonicalHash({
    toolIds: [...toolIds].sort(),
    matchedPatternIds: matched.map((m) => m.pattern.id).sort(),
    promptVersion: PROMPT_VERSION,
    provider: resolveProvider(),
  });
  const outputHash = canonicalHash(scenarioPayload);

  return await db.transaction(async (tx) => {
    const [decision] = await tx
      .insert(decisionRecords)
      .values({
        agentName: AGENT_NAME,
        promptVersion: PROMPT_VERSION,
        modelId: providerResult.modelId,
        modelParams: providerResult.modelParams,
        inputHash,
        outputHash,
        retrievalSources: null,
        promptTokens: providerResult.promptTokens,
        completionTokens: providerResult.completionTokens,
        costUsd: providerResult.costUsd.toFixed(6),
      })
      .returning();

    const [scenario] = await tx
      .insert(alchemyScenarios)
      .values({
        toolIds: tools.map((t) => t.id),
        matchedPatternIds: matched.map((m) => m.pattern.id),
        narrative: scenarioPayload.narrative,
        emergentCapabilities: scenarioPayload.emergentCapabilities,
        mitigations: scenarioPayload.mitigations,
        saifControls: scenarioPayload.saifControls,
        confidence: scenarioPayload.confidence.toFixed(2),
        decisionRecordId: decision.id,
      })
      .returning();

    return { scenario, decision, matched };
  });
}
