/**
 * Deterministic synergy matcher. Pure function — no IO, no LLM.
 *
 * Given a set of tools and a set of synergy patterns, return every pattern
 * whose `requiredCapabilities` are all present somewhere across the union of
 * the tools' capabilities. For each match, also return the subset of tools
 * that contributed at least one of the required capabilities (useful for
 * UI attribution: "Vishing matched because of ElevenLabs + ChatGPT").
 *
 * Patterns with an empty `requiredCapabilities` array are skipped as
 * degenerate — they would otherwise match every tool set, including the
 * empty set.
 *
 * Closes CRITIQUE.md F1 for the deterministic candidate-generation path.
 * The novelty / LLM-discovery path is deferred to v0.2.
 */
export interface ToolLike {
  id: string;
  name: string;
  capabilities: readonly string[];
}

export interface SynergyPatternLike {
  id: string;
  name: string;
  requiredCapabilities: readonly string[];
}

export interface MatchedPattern<
  P extends SynergyPatternLike = SynergyPatternLike,
  T extends ToolLike = ToolLike,
> {
  pattern: P;
  contributingTools: T[];
}

export function matchSynergies<
  T extends ToolLike,
  P extends SynergyPatternLike,
>(tools: readonly T[], patterns: readonly P[]): MatchedPattern<P, T>[] {
  if (tools.length === 0) return [];

  const presentCapabilities = new Set<string>();
  for (const tool of tools) {
    for (const cap of tool.capabilities) presentCapabilities.add(cap);
  }

  const matched: MatchedPattern<P, T>[] = [];

  for (const pattern of patterns) {
    if (pattern.requiredCapabilities.length === 0) continue;

    const allPresent = pattern.requiredCapabilities.every((c) =>
      presentCapabilities.has(c),
    );
    if (!allPresent) continue;

    const requiredSet = new Set(pattern.requiredCapabilities);
    const contributingTools = tools.filter((t) =>
      t.capabilities.some((c) => requiredSet.has(c)),
    );

    matched.push({ pattern, contributingTools });
  }

  return matched;
}
