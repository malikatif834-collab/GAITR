"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Loader2 } from "lucide-react";
import type { AiTool, AlchemyScenario, CapabilitySynergy, DecisionRecord } from "@/lib/db/schema";
import { ToolPicker } from "@/components/tool-picker";
import { SynergyPreview } from "@/components/synergy-preview";
import { ScenarioCard } from "@/components/scenario-card";
import { ProvenanceDrawer } from "@/components/provenance-drawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type SynthesisResponse = {
  scenario: AlchemyScenario;
  decision: DecisionRecord;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${url}: ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export default function AlchemyPage() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toolsQ = useQuery({
    queryKey: ["tools"],
    queryFn: () => fetchJson<{ tools: AiTool[] }>("/api/tools"),
  });

  const patternsQ = useQuery({
    queryKey: ["patterns"],
    queryFn: () =>
      fetchJson<{ patterns: CapabilitySynergy[] }>("/api/patterns"),
  });

  const synthesizeM = useMutation({
    mutationFn: (toolIds: string[]) =>
      fetchJson<SynthesisResponse>("/api/alchemy/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
    },
  });

  const selectedTools = useMemo(() => {
    const list = toolsQ.data?.tools ?? [];
    return list.filter((t) => selectedIds.has(t.id));
  }, [toolsQ.data?.tools, selectedIds]);

  const canSynthesize = selectedIds.size >= 1 && !synthesizeM.isPending;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 space-y-1">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          GAITR · Alchemy Engine
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Synthesize a threat scenario
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Pick AI tools the way an attacker might assemble them. The deterministic matcher fires
          known synergy patterns; the synthesizer composes a SAIF-mapped scenario with full
          decision-record provenance.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            1. Pick tools
          </h2>
          {toolsQ.isLoading ? (
            <ToolPickerSkeleton />
          ) : toolsQ.error ? (
            <ErrorBox message={(toolsQ.error as Error).message} />
          ) : (
            <ToolPicker
              tools={toolsQ.data!.tools}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
            />
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            2. Review matched synergies
          </h2>
          {patternsQ.isLoading || toolsQ.isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <SynergyPreview
              tools={toolsQ.data!.tools}
              patterns={patternsQ.data?.patterns ?? []}
              selectedIds={selectedIds}
            />
          )}

          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              disabled={!canSynthesize}
              onClick={() =>
                synthesizeM.mutate(Array.from(selectedIds))
              }
              className="gap-2"
            >
              {synthesizeM.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Synthesizing…
                </>
              ) : (
                <>
                  <FlaskConical className="h-4 w-4" />
                  Synthesize scenario
                </>
              )}
            </Button>
            {synthesizeM.error && (
              <ErrorBox message={(synthesizeM.error as Error).message} />
            )}
          </div>

          {synthesizeM.data && (
            <ScenarioCard
              scenario={synthesizeM.data.scenario}
              tools={selectedTools}
              detailHref={`/scenarios/${synthesizeM.data.scenario.id}`}
              rightSlot={<ProvenanceDrawer decision={synthesizeM.data.decision} />}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function ToolPickerSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </div>
  );
}
