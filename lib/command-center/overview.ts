import { count, desc } from "drizzle-orm";
import { db, tryDb } from "@/lib/db/client";
import {
  aiTools,
  alchemyScenarios,
  capabilitySynergies,
} from "@/lib/db/schema";
import { SAIF_CONTROLS, type SaifControl } from "@/lib/db/capabilities";

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

export interface CommandCenterData {
  databaseAvailable: boolean;
  counts: { tools: number; synergies: number; scenarios: number };
  peakRisk: number;
  avgConfidence: number | null;
  saifDistribution: { control: SaifControl; count: number }[];
  recentScenarios: SpotlightScenario[];
  scenariosByDay: { date: string; count: number }[];
}

const SPOTLIGHT_LIMIT = 5;
const TREND_DAYS = 14;

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
    ]),
  );

  if (result === null) {
    return {
      databaseAvailable: false,
      counts: { tools: 0, synergies: 0, scenarios: 0 },
      peakRisk: 0,
      avgConfidence: null,
      saifDistribution: SAIF_CONTROLS.map((control) => ({ control, count: 0 })),
      recentScenarios: [],
      scenariosByDay: bucketByDay([], TREND_DAYS),
    };
  }

  const [scenarioRows, toolCountRows, synergyRows] = result;

  const peakRisk = synergyRows.length
    ? Math.max(...synergyRows.map((r) => Number(r.riskMultiplier)))
    : 0;

  const avgConfidence = scenarioRows.length
    ? scenarioRows.reduce((sum, r) => sum + Number(r.confidence), 0) /
      scenarioRows.length
    : null;

  const saifDistribution = SAIF_CONTROLS.map((control) => ({
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

  return {
    databaseAvailable: true,
    counts: {
      tools: toolCountRows[0]?.value ?? 0,
      synergies: synergyRows.length,
      scenarios: scenarioRows.length,
    },
    peakRisk,
    avgConfidence,
    saifDistribution,
    recentScenarios,
    scenariosByDay: bucketByDay(
      scenarioRows.map((r) => r.createdAt),
      TREND_DAYS,
    ),
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
