import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db, tryDb } from "@/lib/db/client";
import {
  aiTools,
  alchemyScenarios,
  capabilitySynergies,
  decisionRecords,
} from "@/lib/db/schema";
import { ScenarioCard } from "@/components/scenario-card";
import { ProvenanceDrawer } from "@/components/provenance-drawer";
import { NoDatabaseBanner } from "@/components/no-database-banner";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ScenarioDetailPage({ params }: PageProps) {
  const { id } = await params;

  /* Two distinct failure cases must stay distinguishable: a missing scenario
     id is a real 404; an unreachable DB is demo mode. notFound() throws, so
     it cannot be called inside tryDb — return a tagged result instead. */
  const result = await tryDb(async () => {
    const [scenario] = await db
      .select()
      .from(alchemyScenarios)
      .where(eq(alchemyScenarios.id, id))
      .limit(1);

    if (!scenario) return { kind: "not-found" as const };

    const [decision] = await db
      .select()
      .from(decisionRecords)
      .where(eq(decisionRecords.id, scenario.decisionRecordId))
      .limit(1);

    const tools = scenario.toolIds.length
      ? await db.select().from(aiTools).where(inArray(aiTools.id, scenario.toolIds))
      : [];

    const matchedPatterns = scenario.matchedPatternIds.length
      ? await db
          .select()
          .from(capabilitySynergies)
          .where(inArray(capabilitySynergies.id, scenario.matchedPatternIds))
      : [];

    return { kind: "ok" as const, scenario, decision, tools, matchedPatterns };
  });

  if (result === null) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <header className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            GAITR · Alchemy Engine
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Scenario detail
          </h1>
          <p className="text-sm text-muted-foreground">
            Scenario provenance lives in the database. Attach one to inspect
            narratives, mitigations, and decision records.
          </p>
        </header>
        <NoDatabaseBanner />
      </div>
    );
  }

  if (result.kind === "not-found") notFound();

  const { scenario, decision, tools, matchedPatterns } = result;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <ScenarioCard
        scenario={scenario}
        tools={tools}
        matchedPatterns={matchedPatterns}
        rightSlot={decision && <ProvenanceDrawer decision={decision} />}
      />
    </div>
  );
}
