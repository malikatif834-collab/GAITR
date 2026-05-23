import { EvalScorecard } from "@/components/ops/eval-scorecard";
import { RunsExplorer } from "@/components/ops/runs-explorer";
import { RunControls } from "@/components/ops/run-controls";

/* Agent Operations — the thin GAITR-specific page per ADR 0004 D5 /
   ADR 0005 D5. Three sections: domain eval scorecard, decision-record
   explainability (runs explorer), operator run-controls. Gated by
   `proxy.ts` — unauth redirects to /ops/login; unset OPS_ADMIN_TOKEN
   404s the whole surface. */

export const dynamic = "force-dynamic";

export default function OpsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          GAITR · Agent Operations
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Orchestrator + agent controls
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The three things off-the-shelf observability does not do: domain
          quality scorecard, decision-record explainability, and operator
          run-controls. Phase 3 / ADR 0005.
        </p>
      </header>

      <section>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Eval scorecard
        </h2>
        <EvalScorecard />
      </section>

      <section>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Run controls
        </h2>
        <RunControls />
      </section>

      <section>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Decision-record explainability
        </h2>
        <RunsExplorer />
      </section>
    </div>
  );
}
