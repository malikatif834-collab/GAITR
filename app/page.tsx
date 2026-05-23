import { getCommandCenterData } from "@/lib/command-center/overview";
import { KpiStrip } from "@/components/command-center/kpi-strip";
import { PipelineRiver } from "@/components/command-center/pipeline-river";
import { IntelligenceSpotlight } from "@/components/command-center/intelligence-spotlight";
import { SaifThreatLandscape } from "@/components/command-center/saif-threat-landscape";
import { ThreatAnalytics } from "@/components/command-center/threat-analytics";
import { OrchestratorStatus } from "@/components/command-center/orchestrator-status";
import { NoDatabaseBanner } from "@/components/no-database-banner";

/* Command Center — the platform overview (ADR 0003 D5, Phase 1). */
export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const data = await getCommandCenterData();

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      {!data.databaseAvailable && <NoDatabaseBanner />}

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

      <KpiStrip data={data} />

      <PipelineRiver liveScenarioCount={data.counts.scenarios} />

      <div className="grid gap-4 lg:grid-cols-3">
        <IntelligenceSpotlight
          scenarios={data.recentScenarios}
          className="lg:col-span-2"
        />
        <SaifThreatLandscape distribution={data.saifDistribution} />
        <ThreatAnalytics
          series={data.scenariosByDay}
          className="lg:col-span-2"
        />
        <OrchestratorStatus />
      </div>
    </div>
  );
}
