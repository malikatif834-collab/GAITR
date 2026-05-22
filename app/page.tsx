/* Command Center — the platform overview (ADR 0003 D5, Phase 1).
   Surfaces are added incrementally: pipeline river, then the panels. */
export default function CommandCenterPage() {
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
    </div>
  );
}
