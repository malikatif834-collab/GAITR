import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  aiTools,
  alchemyScenarios,
  capabilitySynergies,
  decisionRecords,
} from "@/lib/db/schema";
import { ScenarioCard } from "@/components/scenario-card";
import { ProvenanceDrawer } from "@/components/provenance-drawer";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ScenarioDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [scenario] = await db
    .select()
    .from(alchemyScenarios)
    .where(eq(alchemyScenarios.id, id))
    .limit(1);

  if (!scenario) notFound();

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
