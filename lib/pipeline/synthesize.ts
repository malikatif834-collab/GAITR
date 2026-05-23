import { synthesizeScenario } from "@/lib/alchemy/synthesize";
import { runStage } from "./run";
import type { StageOutput } from "./types";

/**
 * The `synthesize` stage. Thin wrapper around `lib/alchemy/synthesize.ts`
 * (which already owns the prompt, the matcher, the provider call, and
 * the decision-record write) so every pipeline-level synthesis also
 * lands an `agent_runs` row.
 */

export interface SynthesizeOutput {
  scenarioId: string;
  decisionRecordId: string;
}

export async function synthesizeStage(input: {
  toolIds: string[];
}): Promise<StageOutput<SynthesizeOutput>> {
  return runStage("synthesize", input, async () => {
    const result = await synthesizeScenario(input.toolIds);
    const output: SynthesizeOutput = {
      scenarioId: result.scenario.id,
      decisionRecordId: result.decision.id,
    };
    return {
      output,
      outputHashable: { scenarioId: output.scenarioId },
    };
  });
}
