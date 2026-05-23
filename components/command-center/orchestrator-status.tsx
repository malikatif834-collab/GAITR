"use client";

import { motion } from "motion/react";
import { BentoCard } from "@/components/ui/bento-card";
import { cn } from "@/lib/utils";
import { STAGES } from "@/lib/command-center/pipeline";
import type { StageActivityMap } from "@/lib/command-center/overview";

/* Tier-1 orchestrator status. The controller itself lands in Phase 3
   (ADR 0005) — clearly labelled as standby. Per-stage readiness reads
   from agent_runs activity, so each row shows the live run count once
   Phase 2's stages are wired. */
export function OrchestratorStatus({
  stageActivity,
  className,
}: {
  stageActivity: StageActivityMap;
  className?: string;
}) {
  return (
    <BentoCard className={cn("flex flex-col p-5", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Orchestrator</h2>
          <p className="text-xs text-muted-foreground">
            Tier-1 controller — dispatch &amp; governance
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-okabe-yellow"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          Standby
        </span>
      </div>

      <ul className="space-y-1.5">
        {STAGES.map((stage) => {
          const activity = stageActivity[stage.id];
          const active = activity.runs > 0;
          return (
            <li
              key={stage.id}
              className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm"
            >
              <span className="font-mono text-[10px] text-muted-foreground">
                {String(stage.order).padStart(2, "0")}
              </span>
              <span className="font-medium">{stage.label}</span>
              <span className="ml-auto flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
                {active && (
                  <span className="text-muted-foreground">
                    {activity.runs}
                  </span>
                )}
                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    active ? "text-okabe-green" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      active ? "bg-okabe-green" : "bg-muted-foreground/50",
                    )}
                  />
                  {active ? "Operational" : "Idle"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 rounded-lg border border-dashed border-border p-2.5 text-[11px] leading-relaxed text-muted-foreground">
        The autonomous orchestrator — scheduler, stage dispatch, decision
        records, governance-gate routing — lands in Phase 3 (ADR 0005).
      </p>
    </BentoCard>
  );
}
