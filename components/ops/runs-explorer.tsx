"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { BentoCard } from "@/components/ui/bento-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ProvenanceFields } from "@/components/provenance-fields";
import { cn } from "@/lib/utils";

interface RunRow {
  id: string;
  stageId: string;
  status: string;
  idempotencyKey: string;
  inputHash: string;
  outputHash: string | null;
  decisionRecordId: string | null;
  decisionRecord: {
    agentName: string;
    promptVersion: string;
    modelId: string;
  } | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface RunsResponse {
  rows: RunRow[];
  count: number;
  limit: number;
}

const STAGES = [
  "ingest",
  "extract",
  "correlate",
  "synthesize",
  "map",
  "report",
] as const;
const STATUSES = ["succeeded", "failed", "running"] as const;

export function RunsExplorer() {
  const [rows, setRows] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stageFilter, setStageFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [orchestratorOnly, setOrchestratorOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (stageFilter) p.set("stage", stageFilter);
    if (statusFilter) p.set("status", statusFilter);
    if (orchestratorOnly) p.set("orchestratorOnly", "true");
    p.set("limit", "100");
    return p.toString();
  }, [stageFilter, statusFilter, orchestratorOnly]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/ops/runs?${params}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`runs fetch failed: ${r.status}`);
        return r.json() as Promise<RunsResponse>;
      })
      .then((d) => {
        if (cancelled) return;
        setRows(d.rows);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params, refreshTick]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <BentoCard className="flex flex-col p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Runs explorer</h2>
          <p className="text-xs text-muted-foreground">
            Every agent_runs row + its decision-record provenance
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRefreshTick((t) => t + 1)}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      <Filters
        stage={stageFilter}
        setStage={setStageFilter}
        status={statusFilter}
        setStatus={setStatusFilter}
        orchestratorOnly={orchestratorOnly}
        setOrchestratorOnly={setOrchestratorOnly}
      />

      {error && (
        <p className="mt-3 rounded-md border border-okabe-vermillion/40 bg-okabe-vermillion/10 p-2 text-xs text-okabe-vermillion">
          {error}
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-md border border-border">
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card text-left font-mono uppercase tracking-wider text-[10px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Started</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Agent</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      No runs match the current filters.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={cn(
                      "cursor-pointer border-t border-border/70 hover:bg-secondary/40",
                      selectedId === r.id && "bg-secondary",
                    )}
                  >
                    <td className="px-3 py-2 font-mono tabular-nums">
                      {new Date(r.startedAt).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2 font-mono">{r.stageId}</td>
                    <td className="px-3 py-2">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-3 py-2 font-mono truncate max-w-[180px]">
                      {r.decisionRecord?.agentName ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-md border border-border p-4">
          {selected ? (
            <RunDetail row={selected} />
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Select a row to inspect its decision record.
            </p>
          )}
        </div>
      </div>
    </BentoCard>
  );
}

function Filters({
  stage,
  setStage,
  status,
  setStatus,
  orchestratorOnly,
  setOrchestratorOnly,
}: {
  stage: string;
  setStage: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  orchestratorOnly: boolean;
  setOrchestratorOnly: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 text-xs">
      <div className="space-y-1">
        <Label
          htmlFor="ops-stage-filter"
          className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
        >
          Stage
        </Label>
        <select
          id="ops-stage-filter"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          className="h-8 rounded-md border border-border bg-card px-2 text-xs"
        >
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label
          htmlFor="ops-status-filter"
          className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
        >
          Status
        </Label>
        <select
          id="ops-status-filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-8 rounded-md border border-border bg-card px-2 text-xs"
        >
          <option value="">Any</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 pb-1">
        <Checkbox
          id="ops-orch-only"
          checked={orchestratorOnly}
          onCheckedChange={(v) => setOrchestratorOnly(v === true)}
        />
        <Label htmlFor="ops-orch-only" className="text-xs">
          Orchestrator-planned only
        </Label>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, string> = {
    succeeded: "bg-okabe-green/15 text-okabe-green border-okabe-green/30",
    running: "bg-okabe-yellow/15 text-okabe-yellow border-okabe-yellow/30",
    failed:
      "bg-okabe-vermillion/15 text-okabe-vermillion border-okabe-vermillion/30",
  };
  return (
    <span
      className={cn(
        "rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        palette[status] ?? "border-border text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

function RunDetail({ row }: { row: RunRow }) {
  const [decision, setDecision] = useState<Parameters<
    typeof ProvenanceFields
  >[0]["decision"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!row.decisionRecordId) {
      setDecision(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/ops/runs/${row.id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setDecision(d.decision);
      })
      .catch(() => {
        if (cancelled) return;
        setDecision(null);
      });
    return () => {
      cancelled = true;
    };
  }, [row.id, row.decisionRecordId]);

  const replay = async (endpoint: "replay" | "retry") => {
    setBusy(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/ops/runs/${row.id}/${endpoint}`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        setActionMessage(`${endpoint} failed: ${json.message ?? res.status}`);
      } else {
        setActionMessage(
          `${endpoint} → new agent_run ${(json.newAgentRunId as string).slice(0, 8)} (${json.cached ? "cached" : json.status})`,
        );
      }
    } catch (err) {
      setActionMessage(
        `${endpoint} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          agent_run · {row.stageId}
        </p>
        <p className="font-mono text-xs break-all">{row.id}</p>
      </div>
      {row.errorMessage && (
        <div className="rounded-md border border-okabe-vermillion/40 bg-okabe-vermillion/10 p-2 text-[11px] text-okabe-vermillion">
          {row.errorMessage}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => replay("replay")}
        >
          Replay (force rerun)
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || row.status !== "failed"}
          onClick={() => replay("retry")}
        >
          Retry (failed only)
        </Button>
      </div>
      {actionMessage && (
        <p className="font-mono text-[10px] text-muted-foreground">
          {actionMessage}
        </p>
      )}
      {decision ? (
        <ProvenanceFields decision={decision} />
      ) : row.decisionRecordId ? (
        <p className="text-xs text-muted-foreground">
          Loading decision record…
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          No decision record — pure-code stage (ingest / correlate v1).
        </p>
      )}
    </div>
  );
}
