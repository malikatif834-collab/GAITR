import type { SaifControl } from "@/lib/db/capabilities";
import type { ProviderResult, SynthesisInput } from "../types";
import { PROMPT_VERSION } from "../prompts/scene-synth.v1";

const SAIF_MITIGATION_TEMPLATES: Record<SaifControl, string> = {
  D: "Audit and version training data; require provenance signatures on ingest.",
  I: "Isolate model serving infrastructure; restrict outbound network from inference workers.",
  M: "Add SCA + SBOM verification on every ML pipeline build.",
  A: "Validate inputs and filter outputs at the application boundary; rate-limit user requests.",
  AS: "Require human approval for high-impact agent actions; implement kill-switch on autonomous loops.",
  G: "Embed C2PA content provenance; deploy synthetic-media detection at the upload boundary.",
};

/**
 * Deterministic stub provider used when ALCHEMY_LLM_PROVIDER=stub. Produces
 * a structurally valid scenario derived from the matched patterns and tool
 * names — useful for the v0.1 demo, end-to-end testing, and offline dev
 * without an Anthropic key. Output is reproducible for the same input.
 */
export function stubSynthesize(input: SynthesisInput): ProviderResult {
  const toolNames = input.tools.map((t) => t.name);
  const patterns = input.matched.map((m) => m.pattern);

  const allSaif = uniqueOrdered(
    patterns.flatMap((p) => p.saifControls as SaifControl[]),
  );
  const allCaps = uniqueOrdered(input.tools.flatMap((t) => t.capabilities));

  const narrative =
    patterns.length === 0
      ? `The selected tools (${toolNames.join(", ")}) span ${allCaps.length} distinct capabilities but match no synergy pattern in the current library. The combination is not a known multiplier. Consider adding tools whose capabilities complete a known pattern, or submit this combination for the v0.2 novelty queue.`
      : `Combining ${toolNames.join(" + ")} produces a known multi-tool threat. ${patterns.map((p) => p.emergentThreat).join(" In parallel, ")} The combined capability set spans ${allCaps.join(", ")}, mapping to SAIF categories ${allSaif.join(", ")}.`;

  const emergentCapabilities =
    patterns.length === 0
      ? ["No known emergent threat — combination is novel"]
      : patterns.map((p) => p.name);

  const mitigations =
    allSaif.length === 0
      ? [
          {
            control: "A" as SaifControl,
            action: "Review tool usage policy and add capability gating.",
            rationale: "No matched patterns; default to application-layer review.",
          },
        ]
      : allSaif.map((control) => ({
          control,
          action: SAIF_MITIGATION_TEMPLATES[control],
          rationale: `Required by ${patterns
            .filter((p) => (p.saifControls as SaifControl[]).includes(control))
            .map((p) => p.name)
            .join(", ")}.`,
        }));

  const confidence =
    patterns.length === 0 ? 0.2 : Math.min(0.5 + 0.1 * patterns.length, 0.9);

  return {
    scenario: {
      narrative,
      emergentCapabilities,
      mitigations,
      saifControls: allSaif.length > 0 ? allSaif : (["A"] as SaifControl[]),
      confidence,
    },
    modelId: "stub-deterministic@v1",
    modelParams: {
      provider: "stub",
      promptVersion: PROMPT_VERSION,
      seed: 1,
    },
    promptTokens: 0,
    completionTokens: 0,
    costUsd: 0,
  };
}

function uniqueOrdered<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}
