/* Smoke test for the orchestrator runTick — not part of the test suite,
   just a way to exercise the full state→plan→dispatch loop against a
   live DB. Run with:
     DATABASE_URL=... pnpm tsx --env-file=.env.local scripts/smoke-tick.ts */
import { runTick } from "../lib/orchestrator/tick";

async function main() {
  const report = await runTick({ reason: "manual" });
  console.log(
    JSON.stringify(
      {
        tickId: report.tickId,
        planned: report.planned,
        dispatched: report.dispatched,
        cached: report.cached,
        failed: report.failed,
        truncated: report.truncated,
        durationMs: report.durationMs,
        decisionRecordId: report.decisionRecordId,
        actionsSample: report.actions.slice(0, 3),
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
