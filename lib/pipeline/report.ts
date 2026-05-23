import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  aiTools,
  alchemyScenarios,
  briefs,
  saifControls,
  saifMappings,
} from "@/lib/db/schema";
import { runStage, createStubDecisionRecord } from "./run";
import type { StageOutput, Subject } from "./types";

/**
 * The `report` stage. Composes a markdown brief over already-mapped +
 * scored data — narrative composition only, no new analysis
 * (CRITIQUE C2). Phase 2 ships the scenario path; the Anthropic
 * provider would replace the templated body with a real composition.
 */

export interface ReportOutput {
  briefId: string;
  decisionRecordId: string;
}

export async function composeBrief(
  subject: Subject,
): Promise<StageOutput<ReportOutput>> {
  return runStage("report", subject, async () => {
    if (subject.kind !== "scenario") {
      throw new Error(
        `report: subject kind ${subject.kind} not yet implemented in Phase 2`,
      );
    }

    const [scenario] = await db
      .select()
      .from(alchemyScenarios)
      .where(eq(alchemyScenarios.id, subject.id))
      .limit(1);
    if (!scenario) {
      throw new Error(`report: unknown scenario ${subject.id}`);
    }

    const tools = scenario.toolIds.length
      ? await db.select().from(aiTools).where(inArray(aiTools.id, scenario.toolIds))
      : [];

    const mappings = await db
      .select()
      .from(saifMappings)
      .where(eq(saifMappings.subjectId, scenario.id));
    const mappedControlIds = mappings.map((m) => m.saifControlId);
    const controlsForBrief = mappedControlIds.length
      ? await db
          .select()
          .from(saifControls)
          .where(inArray(saifControls.id, mappedControlIds))
      : [];

    const title = `Brief: ${scenario.emergentCapabilities.join(" · ")}`;
    const body = renderScenarioBrief({
      scenario,
      tools: tools.map((t) => t.name),
      mappedControls: controlsForBrief.map((c) => ({
        code: c.code,
        title: c.title,
      })),
    });

    const decisionRecordId = await createStubDecisionRecord({
      agentName: "brief-reporter",
      inputHash: scenario.id,
      outputHash: body,
    });

    const [row] = await db
      .insert(briefs)
      .values({
        title,
        body,
        subjectKind: "scenario",
        subjectId: scenario.id,
        decisionRecordId,
      })
      .returning({ id: briefs.id });

    const output: ReportOutput = { briefId: row.id, decisionRecordId };
    return { output, outputHashable: { title, body: body.length } };
  });
}

interface ScenarioForBrief {
  narrative: string;
  emergentCapabilities: string[];
  confidence: string | number;
}

interface MappedControl {
  code: string;
  title: string;
}

/** Pure render of the brief body — testable, deterministic. */
export function renderScenarioBrief(input: {
  scenario: ScenarioForBrief;
  tools: string[];
  mappedControls: MappedControl[];
}): string {
  const lines: string[] = [];
  lines.push(`## Threat`);
  lines.push("");
  lines.push(input.scenario.narrative);
  lines.push("");
  lines.push(`**Confidence:** ${Number(input.scenario.confidence).toFixed(2)}`);
  lines.push("");
  lines.push(`## Tools involved`);
  lines.push("");
  lines.push(input.tools.length ? input.tools.map((t) => `- ${t}`).join("\n") : "_None specified._");
  lines.push("");
  lines.push(`## SAIF controls`);
  lines.push("");
  lines.push(
    input.mappedControls.length
      ? input.mappedControls
          .map((c) => `- **${c.code}** — ${c.title}`)
          .join("\n")
      : "_Run the map stage first to populate SAIF mappings._",
  );
  return lines.join("\n");
}
