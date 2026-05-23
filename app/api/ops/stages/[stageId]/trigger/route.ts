import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestSource } from "@/lib/pipeline/ingest";
import { extractFromIncident } from "@/lib/pipeline/extract";
import { correlateIncident } from "@/lib/pipeline/correlate";
import { mapSubject } from "@/lib/pipeline/map";
import { composeBrief } from "@/lib/pipeline/report";
import { synthesizeStage } from "@/lib/pipeline/synthesize";
import type { StageId, Subject } from "@/lib/pipeline/types";

/* Operator-triggered stage dispatch. Auth handled by middleware.
   Force-rerun passes an idempotencyOverride to bypass the cache — the
   original agent_runs row is preserved; a new row is written.

   SAFETY: live external ingestion is gated to Phase 5 behind
   /security-review. The Phase-3 ingest stage always emits fixture
   data so allowing this trigger is safe today. When Phase 5 adds a
   live mode on source_registry, add a reject branch here for
   live=true sources (`{ error: "ingest blocked — live sources gated
   to Phase 5" }`, 403). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STAGES = new Set<StageId>([
  "ingest",
  "extract",
  "correlate",
  "synthesize",
  "map",
  "report",
]);

const SubjectSchema = z.object({
  kind: z.enum(["scenario", "fingerprint", "incident"]),
  id: z.string().min(1),
});

const BodySchema = z.object({
  sourceId: z.string().min(1).optional(),
  incidentId: z.string().min(1).optional(),
  subject: SubjectSchema.optional(),
  toolIds: z.array(z.string().min(1)).optional(),
  force: z.boolean().optional(),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ stageId: string }> },
) {
  const { stageId } = await ctx.params;
  if (!VALID_STAGES.has(stageId as StageId)) {
    return NextResponse.json(
      { error: "unknown-stage", stageId },
      { status: 400 },
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const json = await request.json();
    body = BodySchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid-body",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  const idempotencyOverride = body.force ? crypto.randomUUID() : undefined;

  try {
    switch (stageId as StageId) {
      case "ingest": {
        if (!body.sourceId)
          return missing("sourceId is required for ingest");
        const out = await ingestSource(body.sourceId, { idempotencyOverride });
        return NextResponse.json(out, { status: 200 });
      }
      case "extract": {
        if (!body.incidentId)
          return missing("incidentId is required for extract");
        const out = await extractFromIncident(body.incidentId, {
          idempotencyOverride,
        });
        return NextResponse.json(out, { status: 200 });
      }
      case "correlate": {
        if (!body.incidentId)
          return missing("incidentId is required for correlate");
        const out = await correlateIncident(body.incidentId, {
          idempotencyOverride,
        });
        return NextResponse.json(out, { status: 200 });
      }
      case "map": {
        if (!body.subject)
          return missing("subject {kind,id} is required for map");
        const out = await mapSubject(body.subject as Subject, {
          idempotencyOverride,
        });
        return NextResponse.json(out, { status: 200 });
      }
      case "report": {
        if (!body.subject)
          return missing("subject {kind,id} is required for report");
        const out = await composeBrief(body.subject as Subject, {
          idempotencyOverride,
        });
        return NextResponse.json(out, { status: 200 });
      }
      case "synthesize": {
        if (!body.toolIds?.length)
          return missing("toolIds[] is required for synthesize");
        const out = await synthesizeStage(
          { toolIds: body.toolIds },
          { idempotencyOverride },
        );
        return NextResponse.json(out, { status: 200 });
      }
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: "dispatch-failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

function missing(message: string) {
  return NextResponse.json(
    { error: "missing-field", message },
    { status: 400 },
  );
}
