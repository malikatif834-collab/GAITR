"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/lib/command-center/pipeline";
import type { StageActivity } from "@/lib/command-center/overview";

/* Drill-in panel for a pipeline-river node (ADR 0003 Phase 1 verify:
   "nodes drill in"). Controlled — open state is owned by the river. */
export function StageDetailDialog({
  stage,
  activity,
  onClose,
}: {
  stage: PipelineStage | null;
  activity: StageActivity | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={stage !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        {stage && activity && (
          <div className="space-y-5">
            <DialogHeader>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Pipeline · Stage {stage.order} of 6
              </p>
              <DialogTitle className="text-xl">{stage.label}</DialogTitle>
              <DialogDescription className="leading-relaxed">
                {stage.detail}
              </DialogDescription>
            </DialogHeader>

            <dl className="space-y-2.5 text-sm">
              <Row label="Status">
                <span
                  className={cn(
                    "flex items-center gap-1.5 font-medium",
                    activity.runs > 0
                      ? "text-okabe-green"
                      : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      activity.runs > 0
                        ? "bg-okabe-green"
                        : "bg-muted-foreground/50",
                    )}
                  />
                  {activity.runs > 0 ? "Operational" : "Idle"}
                </span>
              </Row>
              <Row label="Runs">
                <span className="font-mono tabular-nums">
                  {activity.runs.toLocaleString()}{" "}
                  <span className="text-muted-foreground">
                    {stage.outputNoun}
                  </span>
                </span>
              </Row>
              {activity.lastRunAt && (
                <Row label="Last run">
                  <span className="font-mono text-xs">
                    {timeAgo(activity.lastRunAt)}
                  </span>
                </Row>
              )}
              <Row label="Compute">{stage.compute}</Row>
              <Row label="Replaces">{stage.replaces}</Row>
              <Row label="Ships">{stage.phase}</Row>
            </dl>

            {stage.id === "synthesize" ? (
              <Button asChild className="w-full gap-2">
                <Link href="/alchemy">
                  Open the Alchemy Engine
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2 last:border-0">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function timeAgo(iso: string): string {
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
