"use client";

import { useState } from "react";
import { Loader2, Play, Zap } from "lucide-react";
import { BentoCard } from "@/components/ui/bento-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/* The three run-controls per ADR 0004 D5: manual tick, manual stage
   trigger, replay. Live ingestion is blocked in the API; the trigger
   form is intentionally minimal in v1 (operator pastes subject ids by
   hand; commit can grow into a picker later). */

interface TickReport {
  tickId: string;
  reason: string;
  decisionRecordId: string;
  planned: number;
  dispatched: number;
  cached: number;
  failed: number;
  gateDecisions: number;
  evalRows: number;
  durationMs: number;
}

export function RunControls() {
  return (
    <BentoCard className="flex flex-col gap-3 p-5">
      <div>
        <h2 className="text-sm font-semibold">Run controls</h2>
        <p className="text-xs text-muted-foreground">
          Manual orchestrator + stage triggers (Admin only — ADR 0005 D6)
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <TickButton />
        <TriggerStageDialog />
      </div>
    </BentoCard>
  );
}

function TickButton() {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<TickReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/ops/tick", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? `tick failed: ${res.status}`);
      } else {
        setReport(json as TickReport);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <Button onClick={run} disabled={busy} className="w-fit gap-2">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        Run a tick
      </Button>
      {error && (
        <p className="font-mono text-[11px] text-okabe-vermillion">{error}</p>
      )}
      {report && (
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
    </div>
  );
}

const STAGES = [
  "ingest",
  "extract",
  "correlate",
  "synthesize",
  "map",
  "report",
] as const;

function TriggerStageDialog() {
  const [stage, setStage] = useState<(typeof STAGES)[number]>("extract");
  const [sourceId, setSourceId] = useState("");
  const [incidentId, setIncidentId] = useState("");
  const [subjectKind, setSubjectKind] = useState<"scenario" | "fingerprint" | "incident">("scenario");
  const [subjectId, setSubjectId] = useState("");
  const [toolIds, setToolIds] = useState("");
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    const body: Record<string, unknown> = { force };
    if (stage === "ingest") body.sourceId = sourceId;
    if (stage === "extract" || stage === "correlate")
      body.incidentId = incidentId;
    if (stage === "map" || stage === "report")
      body.subject = { kind: subjectKind, id: subjectId };
    if (stage === "synthesize")
      body.toolIds = toolIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    try {
      const res = await fetch(`/api/ops/stages/${stage}/trigger`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? `trigger failed: ${res.status}`);
      } else {
        setResult(json);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Zap className="h-4 w-4" />
          Trigger stage…
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trigger a stage</DialogTitle>
          <DialogDescription>
            Force-run a specific stage with a known subject. Live ingestion
            sources are blocked server-side; see ADR 0005 D5.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <Label htmlFor="trig-stage" className="text-xs">
              Stage
            </Label>
            <select
              id="trig-stage"
              value={stage}
              onChange={(e) =>
                setStage(e.target.value as (typeof STAGES)[number])
              }
              className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {stage === "ingest" && (
            <FieldRow label="source ID (uuid)">
              <Input
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
              />
            </FieldRow>
          )}
          {(stage === "extract" || stage === "correlate") && (
            <FieldRow label="incident ID (uuid)">
              <Input
                value={incidentId}
                onChange={(e) => setIncidentId(e.target.value)}
              />
            </FieldRow>
          )}
          {(stage === "map" || stage === "report") && (
            <>
              <FieldRow label="subject kind">
                <select
                  value={subjectKind}
                  onChange={(e) =>
                    setSubjectKind(
                      e.target.value as "scenario" | "fingerprint" | "incident",
                    )
                  }
                  className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs"
                >
                  <option value="scenario">scenario</option>
                  <option value="fingerprint">fingerprint</option>
                  <option value="incident">incident</option>
                </select>
              </FieldRow>
              <FieldRow label="subject ID (uuid)">
                <Input
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                />
              </FieldRow>
            </>
          )}
          {stage === "synthesize" && (
            <FieldRow label="tool IDs (comma-separated uuids)">
              <Input
                value={toolIds}
                onChange={(e) => setToolIds(e.target.value)}
              />
            </FieldRow>
          )}
          <div className="flex items-center gap-2">
            <Checkbox
              id="trig-force"
              checked={force}
              onCheckedChange={(v) => setForce(v === true)}
            />
            <Label htmlFor="trig-force" className="text-xs">
              Force rerun (new idempotency, preserves the original row)
            </Label>
          </div>
          <Button onClick={submit} disabled={busy} className="w-full gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Dispatch
          </Button>
          {error && (
            <p className="font-mono text-[11px] text-okabe-vermillion">
              {error}
            </p>
          )}
          {Boolean(result) && (
            <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
