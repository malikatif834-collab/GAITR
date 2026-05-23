import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { ingestionEvents, sourceRegistry } from "@/lib/db/schema";
import { runStage, type RunStageOpts } from "./run";
import type { StageOutput } from "./types";

/**
 * The `ingest` stage. Phase 2 ships a stub that emits a single
 * deterministic ingestion_event per source — a placeholder payload
 * derived from the source's own metadata. Live HTTP / RSS fetch stays
 * gated behind /security-review (Phase 5; SSRF + sanitization surface).
 *
 * Idempotency is dual: the runStage agent_run dedupe + the
 * `(source_id, external_ref)` unique index on ingestion_events.
 */

export interface IngestOutput {
  eventId: string;
  externalRef: string;
  skipped: boolean;
}

export async function ingestSource(
  sourceId: string,
  opts: RunStageOpts = {},
): Promise<StageOutput<IngestOutput>> {
  return runStage("ingest", { sourceId }, async () => {
    const [source] = await db
      .select()
      .from(sourceRegistry)
      .where(eq(sourceRegistry.id, sourceId))
      .limit(1);
    if (!source) {
      throw new Error(`ingest: unknown source ${sourceId}`);
    }
    if (!source.enabled) {
      const output: IngestOutput = {
        eventId: "",
        externalRef: "",
        skipped: true,
      };
      return { output, outputHashable: { skipped: true } };
    }

    const externalRef = `phase2-fixture-${source.id.slice(0, 8)}`;
    const payload = {
      title: source.name,
      url: source.url,
      kind: source.kind,
      body:
        source.notes ??
        "Phase 2 fixture record — live ingestion is gated to Phase 5.",
      fetchedAt: new Date().toISOString(),
    };

    const [row] = await db
      .insert(ingestionEvents)
      .values({
        sourceId: source.id,
        externalRef,
        payload,
        sourceTrust: source.trust,
        sanitizationFlags: ["phase2-fixture"],
      })
      .returning({ id: ingestionEvents.id });

    const output: IngestOutput = {
      eventId: row.id,
      externalRef,
      skipped: false,
    };
    return { output, outputHashable: { externalRef, payload } };
  }, opts);
}
