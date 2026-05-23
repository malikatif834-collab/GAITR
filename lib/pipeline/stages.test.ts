import { describe, it, expect } from "vitest";
import {
  inferAtlasIds,
  inferAttackIds,
  inferCapabilities,
  stubExtractFromIncident,
} from "./extract";
import { capabilityConfidence, overlapCount } from "./correlate";
import { renderScenarioBrief } from "./report";

/* Pure-logic tests for the deterministic paths of the pipeline stages.
   DB-touching code is covered by the seedPipelineRuns smoke run in the
   seed script. */

describe("extract — tag inference", () => {
  it("maps deepfake-class tags onto ATLAS T0043", () => {
    expect(inferAtlasIds(["deepfake", "voice-clone"])).toContain("AML.T0043");
  });

  it("dedupes overlapping mappings", () => {
    const ids = inferAtlasIds(["deepfake", "voice-clone", "face-swap"]);
    expect(ids).toEqual(["AML.T0043"]);
  });

  it("returns an empty list for tags with no mapping", () => {
    expect(inferAtlasIds(["unknown-tag"])).toEqual([]);
  });

  it("maps voice-clone tags onto voice-cloning and voice-synthesis", () => {
    const caps = inferCapabilities(["voice-clone"]);
    expect(caps).toContain("voice-cloning");
    expect(caps).toContain("voice-synthesis");
  });

  it("maps BEC tag onto multiple ATT&CK ids", () => {
    expect(inferAttackIds(["BEC"]).length).toBeGreaterThanOrEqual(2);
  });

  it("stub extract carries the incident title through and infers ids", () => {
    const fp = stubExtractFromIncident({
      title: "Test deepfake incident",
      summary: "summary",
      tags: ["deepfake", "BEC"],
    });
    expect(fp.name).toContain("Test deepfake incident");
    expect(fp.description).toBe("summary");
    expect(fp.mitreAtlasIds).toContain("AML.T0043");
    expect(fp.mitreAttackIds).toContain("T1656");
    expect(fp.capabilities).toContain("video-synthesis");
  });
});

describe("correlate — confidence scoring", () => {
  it("counts overlap correctly", () => {
    expect(
      overlapCount({
        toolCapabilities: ["voice-cloning", "code-generation"],
        fingerprintCapabilities: ["voice-cloning", "image-generation"],
      }),
    ).toBe(1);
  });

  it("returns zero on no overlap", () => {
    expect(
      overlapCount({
        toolCapabilities: ["image-generation"],
        fingerprintCapabilities: ["code-generation"],
      }),
    ).toBe(0);
  });

  it("scales confidence with overlap and caps at 0.85", () => {
    expect(capabilityConfidence(0)).toBe(0);
    expect(capabilityConfidence(1)).toBeCloseTo(0.6);
    expect(capabilityConfidence(2)).toBeCloseTo(0.7);
    expect(capabilityConfidence(10)).toBe(0.85);
  });
});

describe("report — brief rendering", () => {
  it("includes narrative, tools, and SAIF controls", () => {
    const body = renderScenarioBrief({
      scenario: {
        narrative: "A voice-clone scam.",
        emergentCapabilities: ["Vishing"],
        confidence: 0.7,
      },
      tools: ["ElevenLabs", "ChatGPT"],
      mappedControls: [{ code: "G3", title: "Misuse prevention policies" }],
    });
    expect(body).toContain("## Threat");
    expect(body).toContain("A voice-clone scam.");
    expect(body).toContain("ElevenLabs");
    expect(body).toContain("ChatGPT");
    expect(body).toContain("**G3**");
    expect(body).toContain("Misuse prevention policies");
  });

  it("falls back gracefully when tools or mappings are empty", () => {
    const body = renderScenarioBrief({
      scenario: { narrative: "x", emergentCapabilities: [], confidence: 0.5 },
      tools: [],
      mappedControls: [],
    });
    expect(body).toContain("_None specified._");
    expect(body).toContain("_Run the map stage first");
  });
});
