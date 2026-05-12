import Anthropic from "@anthropic-ai/sdk";
import {
  PROMPT_SYSTEM,
  PROMPT_TOOL_DESCRIPTION,
  PROMPT_TOOL_INPUT_SCHEMA,
  PROMPT_TOOL_NAME,
  PROMPT_VERSION,
} from "../prompts/scene-synth.v1";
import { SynthesizedScenarioSchema, type ProviderResult, type SynthesisInput } from "../types";

const MODEL_ID = "claude-sonnet-4-6";

// Public per-token pricing for Sonnet 4.6 (USD per million tokens).
// Used only for internal cost tracking; off by O(10%) is fine here.
const COST_PER_MTOK_INPUT = 3.0;
const COST_PER_MTOK_OUTPUT = 15.0;

/**
 * Anthropic provider. Calls Sonnet 4.6 with structured-output-only via
 * tool use; never reads free-form text from the model. Wired but inert
 * unless ALCHEMY_LLM_PROVIDER=anthropic and ANTHROPIC_API_KEY is set.
 *
 * Closes CRITIQUE.md A1 by construction: tool descriptions and vendor
 * names are passed as untrusted JSON fields, never as instructions.
 */
export async function anthropicSynthesize(
  input: SynthesisInput,
): Promise<ProviderResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set but ALCHEMY_LLM_PROVIDER=anthropic.",
    );
  }

  const client = new Anthropic({ apiKey });

  const userInput = {
    tools: input.tools.map((t) => ({
      name: t.name,
      vendor: t.vendor,
      capabilities: t.capabilities,
    })),
    matched: input.matched.map((m) => ({
      pattern: m.pattern.name,
      requiredCapabilities: m.pattern.requiredCapabilities,
      emergentThreat: m.pattern.emergentThreat,
      riskMultiplier: Number(m.pattern.riskMultiplier),
      saifControls: m.pattern.saifControls,
      rationale: m.pattern.rationale,
    })),
  };

  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 1024,
    temperature: 0.4,
    system: [
      {
        type: "text",
        text: PROMPT_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: PROMPT_TOOL_NAME,
        description: PROMPT_TOOL_DESCRIPTION,
        input_schema: PROMPT_TOOL_INPUT_SCHEMA as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: PROMPT_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: JSON.stringify(userInput),
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === PROMPT_TOOL_NAME,
  );

  if (!toolUse) {
    throw new Error(
      "Anthropic response did not include the expected emit_scenario tool call.",
    );
  }

  const parsed = SynthesizedScenarioSchema.parse(toolUse.input);

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costUsd =
    (inputTokens / 1_000_000) * COST_PER_MTOK_INPUT +
    (outputTokens / 1_000_000) * COST_PER_MTOK_OUTPUT;

  return {
    scenario: parsed,
    modelId: MODEL_ID,
    modelParams: {
      provider: "anthropic",
      promptVersion: PROMPT_VERSION,
      temperature: 0.4,
      maxTokens: 1024,
      toolChoice: PROMPT_TOOL_NAME,
    },
    promptTokens: inputTokens,
    completionTokens: outputTokens,
    costUsd,
  };
}
