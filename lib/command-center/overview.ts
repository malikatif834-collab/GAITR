import { and, count, desc, eq, gte, max } from "drizzle-orm";
import { db, tryDb } from "@/lib/db/client";
import {
  agentRuns,
  aiTools,
  alchemyScenarios,
  attackFingerprints,
  briefs,
  capabilitySynergies,
  decisionRecords,
  incidents,
  saifControls,
  saifMappings,
} from "@/lib/db/schema";
import { SAIF_CONTROLS, type SaifControl } from "@/lib/db/capabilities";
import type { StageId } from "@/lib/pipeline/types";

/**
 * Command Center read model. One round of queries, aggregated in JS — the
 * row counts here are small (tens to low hundreds). Everything returned is
 * plain serializable data so it can cross the server → client boundary into
 * the viz components.
 *
 * On DB failure (unset `DATABASE_URL`, unreachable host, missing tables)
 * the function returns the same shape with zero defaults and
 * `databaseAvailable: false`, so the page can render in demo mode with a
 * banner instead of crashing to `app/error.tsx`.
 */

export interface SpotlightScenario {
  id: string;
  title: string;
  narrative: string;
  saifControls: SaifControl[];
  confidence: number;
  createdAt: string;
}

export interface StageActivity {
  runs: number;
  lastRunAt: string | null;
}

export type StageActivityMap = Record<StageId, StageActivity>;

export interface OrchestratorActivity {
  lastTickAt: string | null;
  ticksLast24h: number;
}

export interface CommandCenterData {
  databaseAvailable: boolean;
  counts: {
    tools: number;
    synergies: number;
    scenarios: number;
    incidents: number;
    fingerprints: number;
    mappings: number;
    briefs: number;
  };
  peakRisk: number;
  avgConfidence: number | null;
  saifDistribution: { control: SaifControl; count: number }[];
  recentScenarios: SpotlightScenario[];
  scenariosByDay: { date: string; count: number }[];
  stageActivity: StageActivityMap;
  orchestratorActivity: OrchestratorActivity;
}

const SPOTLIGHT_LIMIT = 5;
const TREND_DAYS = 14;
const STAGE_IDS: StageId[] = [
  "ingest",
  "extract",
  "correlate",
  "synthesize",
  "map",
  "report",
];

function zeroStageActivity(): StageActivityMap {
  return STAGE_IDS.reduce<StageActivityMap>((acc, id) => {
    acc[id] = { runs: 0, lastRunAt: null };
    return acc;
  }, {} as StageActivityMap);
}

export async function getCommandCenterData(): Promise<CommandCenterData> {
  const result = await tryDb(() =>
    Promise.all([
      db
        .select({
          id: alchemyScenarios.id,
          emergentCapabilities: alchemyScenarios.emergentCapabilities,
          narrative: alchemyScenarios.narrative,
          saifControls: alchemyScenarios.saifControls,
          confidence: alchemyScenarios.confidence,
          createdAt: alchemyScenarios.createdAt,
        })
        .from(alchemyScenarios)
        .orderBy(desc(alchemyScenarios.createdAt)),
      db.select({ value: count() }).from(aiTools),
      db
        .select({ riskMultiplier: capabilitySynergies.riskMultiplier })
        .from(capabilitySynergies),
      db.select({ value: count() }).from(incidents),
      db.select({ value: count() }).from(attackFingerprints),
      db.select({ value: count() }).from(briefs),
      db
        .select({
          category: saifControls.category,
          c: count(),
        })
        .from(saifMappings)
        .innerJoin(
          saifControls,
          eq(saifMappings.saifControlId, saifControls.id),
        )
        .groupBy(saifControls.category),
      db
        .select({
          stageId: agentRuns.stageId,
          runs: count(),
          lastRunAt: max(agentRuns.completedAt),
        })
        .from(agentRuns)
        .where(eq(agentRuns.status, "succeeded"))
        .groupBy(agentRuns.stageId),
      db
        .select({
          lastTickAt: max(decisionRecords.createdAt),
        })
        .from(decisionRecords)
        .where(eq(decisionRecords.agentName, "orchestrator")),
      db
        .select({ value: count() })
        .from(decisionRecords)
        .where(
          and(
            eq(decisionRecords.agentName, "orchestrator"),
            gte(
              decisionRecords.createdAt,
              new Date(Date.now() - 24 * 60 * 60 * 1000),
            ),
          ),
        ),
    ]),
  );

  if (result === null) {
    return {
      databaseAvailable: false,
      counts: {
        tools: 0,
        synergies: 0,
        scenarios: 0,
        incidents: 0,
        fingerprints: 0,
        mappings: 0,
        briefs: 0,
      },
      peakRisk: 0,
      avgConfidence: null,
      saifDistribution: SAIF_CONTROLS.map((control) => ({ control, count: 0 })),
      recentScenarios: [],
      scenariosByDay: bucketByDay([], TREND_DAYS),
      stageActivity: zeroStageActivity(),
      orchestratorActivity: { lastTickAt: null, ticksLast24h: 0 },
    };
  }

  const [
    scenarioRows,
    toolCountRows,
    synergyRows,
    incidentCountRows,
    fingerprintCountRows,
    briefCountRows,
    saifMappingByCategory,
    agentRunsByStage,
    orchestratorLastTickRows,
    orchestratorRecentTickRows,
  ] = result;

  const peakRisk = synergyRows.length
    ? Math.max(...synergyRows.map((r) => Number(r.riskMultiplier)))
    : 0;

  const avgConfidence = scenarioRows.length
    ? scenarioRows.reduce((sum, r) => sum + Number(r.confidence), 0) /
      scenarioRows.length
    : null;

  // Prefer live saif_mappings as the source of distribution (Phase 2 map
  // stage output); fall back to scenario.saifControls if mappings are not
  // yet present so the panel never blanks out.
  const mappingsCount = saifMappingByCategory.reduce(
    (sum, r) => sum + Number(r.c),
    0,
  );
  const saifDistribution = mappingsCount > 0
    ? SAIF_CONTROLS.map((control) => ({
        control,
        count: Number(
          saifMappingByCategory.find((r) => r.category === control)?.c ?? 0,
        ),
      }))
    : SAIF_CONTROLS.map((control) => ({
        control,
        count: scenarioRows.filter((r) =>
          (r.saifControls as SaifControl[]).includes(control),
        ).length,
      }));

  const recentScenarios: SpotlightScenario[] = scenarioRows
    .slice(0, SPOTLIGHT_LIMIT)
    .map((r) => ({
      id: r.id,
      title: r.emergentCapabilities.join(" · "),
      narrative: r.narrative,
      saifControls: r.saifControls as SaifControl[],
      confidence: Number(r.confidence),
      createdAt: r.createdAt.toISOString(),
    }));

  const stageActivity = zeroStageActivity();
  for (const row of agentRunsByStage) {
    const id = row.stageId as StageId;
    if (!STAGE_IDS.includes(id)) continue;
    stageActivity[id] = {
      runs: Number(row.runs),
      lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
    };
  }

  const lastTickAt = orchestratorLastTickRows[0]?.lastTickAt ?? null;
  return {
    databaseAvailable: true,
    counts: {
      tools: toolCountRows[0]?.value ?? 0,
      synergies: synergyRows.length,
      scenarios: scenarioRows.length,
      incidents: incidentCountRows[0]?.value ?? 0,
      fingerprints: fingerprintCountRows[0]?.value ?? 0,
      mappings: mappingsCount,
      briefs: briefCountRows[0]?.value ?? 0,
    },
    peakRisk,
    avgConfidence,
    saifDistribution,
    recentScenarios,
    scenariosByDay: bucketByDay(
      scenarioRows.map((r) => r.createdAt),
      TREND_DAYS,
    ),
    stageActivity,
    orchestratorActivity: {
      lastTickAt: lastTickAt ? new Date(lastTickAt).toISOString() : null,
      ticksLast24h: Number(orchestratorRecentTickRows[0]?.value ?? 0),
    },
  };
}

/** Counts timestamps into the last `days` UTC-day buckets, oldest first. */
function bucketByDay(dates: Date[], days: number): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of dates) {
    const key = d.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const out: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return out;
}
