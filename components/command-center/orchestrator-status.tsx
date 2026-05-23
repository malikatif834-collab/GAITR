"use client";

import { motion } from "motion/react";
import { BentoCard } from "@/components/ui/bento-card";
import { cn } from "@/lib/utils";
import { STAGES } from "@/lib/command-center/pipeline";
import type {
  OrchestratorActivity,
  StageActivityMap,
} from "@/lib/command-center/overview";

/* Tier-1 orchestrator status. Phase 3 (ADR 0005) ships the live
   controller: a Vercel cron writes a decision_records row every 15
   minutes and dispatches the planned stages. This card flips from the
   pre-Phase-3 "Standby" placeholder to "Operational · last tick Xm ago"
   when activity is recent. */

const OPERATIONAL_WINDOW_MS = 30 * 60 * 1000; // tick cadence is 15m; allow 2 windows

export function OrchestratorStatus({
  stageActivity,
  orchestratorActivity,
  className,
}: {
  stageActivity: StageActivityMap;
  orchestratorActivity: OrchestratorActivity;
  className?: string;
}) {
  const lastTickMs = orchestratorActivity.lastTickAt
    ? Date.now() - new Date(orchestratorActivity.lastTickAt).getTime()
    : null;
  const operational =
    lastTickMs !== null && lastTickMs < OPERATIONAL_WINDOW_MS;
  const everTicked = orchestratorActivity.lastTickAt !== null;

  return (
    <BentoCard className={cn("flex flex-col p-5", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Orchestrator</h2>
          <p className="text-xs text-muted-foreground">
            Tier-1 controller — dispatch &amp; governance
          </p>
        </div>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
            operational
              ? "border-okabe-green/40 text-okabe-green"
              : everTicked
                ? "border-okabe-yellow/40 text-okabe-yellow"
                : "border-border text-muted-foreground",
          )}
        >
          {operational ? (
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-okabe-green"
              animate={{ opacity: [1, 0.45, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : (
            <motion.span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                everTicked ? "bg-okabe-yellow" : "bg-muted-foreground/50",
              )}
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          {operational ? "Operational" : everTicked ? "Idle" : "Standby"}
        </span>
      </div>

      <p className="mb-3 font-mono text-[11px] text-muted-foreground">
        {orchestratorActivity.lastTickAt
          ? `last tick ${formatRelative(orchestratorActivity.lastTickAt)} · ${orchestratorActivity.ticksLast24h} in 24h`
          : "no ticks yet — set CRON_SECRET on Vercel or trigger from /ops"}
      </p>

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
        Autonomous controller live since Phase 3 (ADR 0005): planner +
        dispatcher + governance gate + eval writer, on a 15-minute cron.
        Operator controls at <code className="font-mono">/ops</code>.
      </p>
    </BentoCard>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleString();
}
