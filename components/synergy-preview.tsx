"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { matchSynergies } from "@/lib/alchemy/match";
import type { AiTool, CapabilitySynergy } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { BentoCard } from "@/components/ui/bento-card";
import { BigNumeric } from "@/components/ui/big-numeric";
import { SaifBadge } from "@/components/saif-badge";
import type { SaifControl } from "@/lib/db/capabilities";

/**
 * Live preview of which synergy patterns the matcher fires for the
 * current tool selection. Re-uses the same pure function the server
 * runs, so what the user sees here is what the synthesizer will receive.
 */
export function SynergyPreview({
  tools,
  patterns,
  selectedIds,
}: {
  tools: AiTool[];
  patterns: CapabilitySynergy[];
  selectedIds: Set<string>;
}) {
  const matched = useMemo(() => {
    const selected = tools.filter((t) => selectedIds.has(t.id));
    return matchSynergies(selected, patterns);
  }, [tools, patterns, selectedIds]);

  if (selectedIds.size === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Pick two or more tools to preview matched synergy patterns.
      </div>
    );
  }

  if (matched.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No synergy patterns match this combination. Synthesizing will produce
        a novel-combination scenario at low confidence.
      </div>
    );
  }

  const peakRisk = Math.max(
    ...matched.map((m) => Number(m.pattern.riskMultiplier)),
  );

  return (
    <div className="space-y-3">
      <BentoCard className="flex items-center justify-between p-4">
        <BigNumeric
          value={`${peakRisk.toFixed(1)}×`}
          label="Peak synergy risk"
          sublabel={`${matched.length} pattern${
            matched.length === 1 ? "" : "s"
          } matched`}
        />
        <Sparkles className="h-5 w-5 text-primary" />
      </BentoCard>
      <ul className="space-y-2">
        {matched.map(({ pattern, contributingTools }) => (
          <li
            key={pattern.id}
            className="rounded-md border border-border bg-card p-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{pattern.name}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {Number(pattern.riskMultiplier).toFixed(1)}× risk
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {pattern.emergentThreat}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1">
                {(pattern.saifControls as SaifControl[]).map((c) => (
                  <SaifBadge key={c} control={c} />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">
                via {contributingTools.map((t) => t.name).join(", ")}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
