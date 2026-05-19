import type { ProviderResult, SynthesisInput } from "../types";
import { stubSynthesize } from "./stub";
import { anthropicSynthesize } from "./anthropic";

export type ProviderName = "stub" | "anthropic";

export function resolveProvider(): ProviderName {
  const raw = process.env.ALCHEMY_LLM_PROVIDER ?? "stub";
  if (raw === "anthropic") return "anthropic";
  return "stub";
}

export async function callProvider(
  input: SynthesisInput,
): Promise<ProviderResult> {
  const provider = resolveProvider();
  if (provider === "anthropic") {
    return anthropicSynthesize(input);
  }
  return stubSynthesize(input);
}
