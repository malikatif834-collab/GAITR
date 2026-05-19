import { describe, expect, it } from "vitest";
import { matchSynergies, type SynergyPatternLike, type ToolLike } from "./match";

const tools = {
  elevenLabs: {
    id: "tool-eleven",
    name: "ElevenLabs",
    capabilities: ["voice-cloning", "voice-synthesis"],
  },
  chatgpt: {
    id: "tool-chatgpt",
    name: "ChatGPT",
    capabilities: ["text-generation", "code-generation"],
  },
  midjourney: {
    id: "tool-midjourney",
    name: "Midjourney",
    capabilities: ["image-generation"],
  },
  cursor: {
    id: "tool-cursor",
    name: "Cursor",
    capabilities: ["code-generation", "autonomous-agent"],
  },
} satisfies Record<string, ToolLike>;

const patterns = {
  vishing: {
    id: "pat-vishing",
    name: "Vishing",
    requiredCapabilities: ["voice-cloning", "text-generation"],
  },
  disinfo: {
    id: "pat-disinfo",
    name: "Disinformation Campaign",
    requiredCapabilities: ["text-generation", "image-generation"],
  },
  malware: {
    id: "pat-malware",
    name: "Autonomous Malware",
    requiredCapabilities: ["code-generation", "autonomous-agent"],
  },
  unmatchable: {
    id: "pat-unmatchable",
    name: "Unmatchable",
    requiredCapabilities: ["never-seen-cap"],
  },
  degenerate: {
    id: "pat-degenerate",
    name: "Degenerate",
    requiredCapabilities: [],
  },
} satisfies Record<string, SynergyPatternLike>;

describe("matchSynergies", () => {
  it("returns no matches for empty tool set", () => {
    expect(
      matchSynergies([], [patterns.vishing, patterns.malware]),
    ).toEqual([]);
  });

  it("returns no matches for empty pattern set", () => {
    expect(matchSynergies([tools.elevenLabs, tools.chatgpt], [])).toEqual([]);
  });

  it("matches a pattern when all required capabilities are present across multiple tools", () => {
    const result = matchSynergies(
      [tools.elevenLabs, tools.chatgpt],
      [patterns.vishing],
    );
    expect(result).toHaveLength(1);
    expect(result[0].pattern.id).toBe("pat-vishing");
    expect(result[0].contributingTools.map((t) => t.id).sort()).toEqual([
      "tool-chatgpt",
      "tool-eleven",
    ]);
  });

  it("does not match when one required capability is missing", () => {
    expect(
      matchSynergies([tools.elevenLabs], [patterns.vishing]),
    ).toEqual([]);
  });

  it("returns all matching patterns when multiple apply", () => {
    const result = matchSynergies(
      [tools.elevenLabs, tools.chatgpt, tools.midjourney],
      [patterns.vishing, patterns.disinfo, patterns.malware],
    );
    const matchedNames = result.map((m) => m.pattern.name).sort();
    expect(matchedNames).toEqual(["Disinformation Campaign", "Vishing"]);
  });

  it("matches patterns whose capabilities are all supplied by a single tool", () => {
    const result = matchSynergies([tools.cursor], [patterns.malware]);
    expect(result).toHaveLength(1);
    expect(result[0].contributingTools).toEqual([tools.cursor]);
  });

  it("filters contributing tools to those that actually supply a required capability", () => {
    const result = matchSynergies(
      [tools.elevenLabs, tools.chatgpt, tools.midjourney],
      [patterns.vishing],
    );
    // Midjourney only has image-generation, not relevant to Vishing
    expect(result[0].contributingTools.map((t) => t.id)).not.toContain(
      "tool-midjourney",
    );
  });

  it("never matches patterns with empty required capabilities", () => {
    expect(
      matchSynergies([tools.elevenLabs, tools.chatgpt], [patterns.degenerate]),
    ).toEqual([]);
  });

  it("never matches patterns whose capabilities are not in the tool set", () => {
    expect(
      matchSynergies([tools.elevenLabs, tools.chatgpt], [patterns.unmatchable]),
    ).toEqual([]);
  });

  it("preserves pattern definition order in the result", () => {
    const result = matchSynergies(
      [tools.elevenLabs, tools.chatgpt, tools.midjourney, tools.cursor],
      [patterns.malware, patterns.vishing, patterns.disinfo],
    );
    expect(result.map((m) => m.pattern.id)).toEqual([
      "pat-malware",
      "pat-vishing",
      "pat-disinfo",
    ]);
  });
});
