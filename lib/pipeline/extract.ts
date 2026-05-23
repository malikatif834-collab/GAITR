import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { attackFingerprints, incidents } from "@/lib/db/schema";
import { runStage, createStubDecisionRecord } from "./run";
import type { StageOutput } from "./types";

/**
 * The `extract` stage. Lifts a structured attack fingerprint out of an
 * incident — name, description, MITRE ATLAS + ATT&CK ids, and the
 * capability set the attack draws on.
 *
 * Phase 2 ships the deterministic stub path: tag-driven inference using
 * the lookup tables below. The Anthropic path lands when the provider
 * is wired (same env switch as synthesize: ALCHEMY_LLM_PROVIDER=anthropic).
 */

const TAG_TO_ATLAS: Record<string, string[]> = {
  deepfake: ["AML.T0043"],
  "voice-clone": ["AML.T0043"],
  "face-swap": ["AML.T0043"],
  "image-generation": ["AML.T0043"],
  "video-call": ["AML.T0043"],
  "prompt-injection": ["AML.T0051"],
  jailbreak: ["AML.T0054"],
  "supply-chain": ["AML.T0010"],
  "autonomous-agent": ["AML.T0061"],
  "code-generation": ["AML.T0024"],
  hallucination: ["AML.T0044"],
  "insecure-output": ["AML.T0046"],
  disinformation: ["AML.T0043"],
  evasion: ["AML.T0015"],
};

const TAG_TO_ATTACK: Record<string, string[]> = {
  deepfake: ["T1656"],
  "voice-clone": ["T1656"],
  "wire-fraud": ["T1657"],
  BEC: ["T1656", "T1534"],
  phishing: ["T1566"],
  robocall: ["T1656"],
  "supply-chain": ["T1195"],
  "code-generation": ["T1195"],
  typosquatting: ["T1195.002"],
  election: ["T1566"],
  political: ["T1656"],
};

const TAG_TO_CAPABILITY: Record<string, string[]> = {
  deepfake: ["video-synthesis", "face-swap"],
  "voice-clone": ["voice-cloning", "voice-synthesis"],
  "image-generation": ["image-generation"],
  "video-call": ["video-synthesis", "voice-cloning"],
  robocall: ["voice-synthesis", "voice-cloning"],
  "prompt-injection": ["text-generation"],
  jailbreak: ["text-generation"],
  "code-generation": ["code-generation"],
  "autonomous-agent": ["autonomous-agent"],
  "supply-chain": ["package-management", "code-generation"],
  hallucination: ["text-generation"],
  chatbot: ["text-generation"],
  "insecure-output": ["text-generation"],
  disinformation: ["text-generation", "image-generation"],
  "destructive-action": ["autonomous-agent", "computer-use"],
  NCSII: ["image-generation"],
  "criminal-LLM": ["text-generation"],
  "research-demonstration": ["autonomous-agent"],
  labor: ["voice-cloning"],
};

const uniq = <T>(xs: T[]) => Array.from(new Set(xs));

export function inferAtlasIds(tags: readonly string[]): string[] {
  return uniq(tags.flatMap((t) => TAG_TO_ATLAS[t] ?? []));
}
export function inferAttackIds(tags: readonly string[]): string[] {
  return uniq(tags.flatMap((t) => TAG_TO_ATTACK[t] ?? []));
}
export function inferCapabilities(tags: readonly string[]): string[] {
  return uniq(tags.flatMap((t) => TAG_TO_CAPABILITY[t] ?? []));
}

/** Pure stub of the extraction step — testable without a DB. */
export function stubExtractFromIncident(incident: {
  title: string;
  summary: string;
  tags: readonly string[];
}) {
  return {
    name: `Fingerprint: ${incident.title.slice(0, 80)}`,
    description: incident.summary,
    mitreAtlasIds: inferAtlasIds(incident.tags),
    mitreAttackIds: inferAttackIds(incident.tags),
    capabilities: inferCapabilities(incident.tags),
  };
}

export interface ExtractOutput {
  fingerprintId: string;
  decisionRecordId: string;
}

export async function extractFromIncident(
  incidentId: string,
): Promise<StageOutput<ExtractOutput>> {
  return runStage(
    "extract",
    { incidentId },
    async () => {
      const [incident] = await db
        .select()
        .from(incidents)
        .where(eq(incidents.id, incidentId))
        .limit(1);
      if (!incident) {
        throw new Error(`extract: unknown incident ${incidentId}`);
      }

      const extracted = stubExtractFromIncident({
        title: incident.title,
        summary: incident.summary,
        tags: incident.tags,
      });

      const decisionRecordId = await createStubDecisionRecord({
        agentName: "fingerprint-extractor",
        inputHash: incident.id,
        outputHash: JSON.stringify(extracted),
      });

      const [row] = await db
        .insert(attackFingerprints)
        .values({
          incidentId: incident.id,
          name: extracted.name,
          description: extracted.description,
          mitreAtlasIds: extracted.mitreAtlasIds,
          mitreAttackIds: extracted.mitreAttackIds,
          capabilities: extracted.capabilities,
          decisionRecordId,
        })
        .returning({ id: attackFingerprints.id });

      const output: ExtractOutput = {
        fingerprintId: row.id,
        decisionRecordId,
      };
      return { output, outputHashable: extracted, decisionRecordId };
    },
  );
}
