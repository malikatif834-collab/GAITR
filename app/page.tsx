import { count } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alchemyScenarios } from "@/lib/db/schema";
import { PipelineRiver } from "@/components/command-center/pipeline-river";

/* Command Center — the platform overview (ADR 0003 D5, Phase 1). */
export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const [row] = await db.select({ value: count() }).from(alchemyScenarios);
  const scenarioCount = row?.value ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          GAITR · Command Center
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Threat intelligence pipeline
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Live view of the six-stage pipeline that turns raw AI-tool
          intelligence into SAIF-mapped threat scenarios under autonomous
          orchestration.
        </p>
      </header>

      <PipelineRiver liveScenarioCount={scenarioCount} />
    </div>
  );
}
