import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  alchemyScenarios,
  saifControls,
  saifMappings,
} from "@/lib/db/schema";
import type { SaifControl } from "@/lib/db/capabilities";
import { runStage, createStubDecisionRecord, type RunStageOpts } from "./run";
import type { StageOutput, Subject } from "./types";

/**
 * The `map` stage. Maps a subject (scenario / fingerprint / incident)
 * onto specific SAIF controls. Phase 2 ships the scenario path: for
 * each SAIF category code on the scenario, pick the first control in
 * that category from the seeded corpus and emit a saif_mapping with
 * the stub provider's deterministic confidence.
 *
 * The Anthropic provider would ground via retrieval over saif_controls
 * descriptions and pick the most specific control, not just the first
 * in the category.
 */

export interface MapOutput {
  mappingIds: string[];
  decisionRecordId: string;
}

export async function mapSubject(
  subject: Subject,
  opts: RunStageOpts = {},
): Promise<StageOutput<MapOutput>> {
  return runStage("map", subject, async () => {
    if (subject.kind !== "scenario") {
      throw new Error(
        `map: subject kind ${subject.kind} not yet implemented in Phase 2`,
      );
    }

    const [scenario] = await db
      .select()
      .from(alchemyScenarios)
      .where(eq(alchemyScenarios.id, subject.id))
      .limit(1);
    if (!scenario) {
      throw new Error(`map: unknown scenario ${subject.id}`);
    }

    const categories = scenario.saifControls as SaifControl[];
    const controls = await db.select().from(saifControls);
    const controlsByCategory = new Map<SaifControl, typeof controls>();
    for (const c of controls) {
      const list = controlsByCategory.get(c.category as SaifControl) ?? [];
      list.push(c);
      controlsByCategory.set(c.category as SaifControl, list);
    }

    const picks = categories
      .map((cat) => {
        const list = controlsByCategory.get(cat);
        if (!list || list.length === 0) return null;
        // Lexicographic-by-code "first in category" — deterministic.
        const sorted = [...list].sort((a, b) => a.code.localeCompare(b.code));
        return sorted[0];
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    const decisionRecordId = await createStubDecisionRecord({
      agentName: "saif-mapper",
      inputHash: scenario.id,
      outputHash: JSON.stringify(picks.map((p) => p.id)),
    });

    const mappingRows = picks.map((control) => ({
      subjectKind: "scenario" as const,
      subjectId: scenario.id,
      saifControlId: control.id,
      confidence: "0.70",
      rationale: `Scenario maps to SAIF ${control.code} (${control.title}) via category ${control.category}.`,
      decisionRecordId,
    }));

    const inserted = mappingRows.length
      ? await db
          .insert(saifMappings)
          .values(mappingRows)
          .returning({ id: saifMappings.id })
      : [];

    const output: MapOutput = {
      mappingIds: inserted.map((r) => r.id),
      decisionRecordId,
    };
    return {
      output,
      outputHashable: { picks: picks.map((p) => p.code) },
      decisionRecordId,
    };
  }, opts);
}
