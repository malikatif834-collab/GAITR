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

/* Drill-in panel for a pipeline-river node (ADR 0003 Phase 1 verify:
   "nodes drill in"). Controlled — open state is owned by the river. */
export function StageDetailDialog({
  stage,
  onClose,
}: {
  stage: PipelineStage | null;
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
        {stage && (
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
                    stage.status === "live"
                      ? "text-okabe-green"
                      : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      stage.status === "live"
                        ? "bg-okabe-green"
                        : "bg-muted-foreground/50",
                    )}
                  />
                  {stage.status === "live" ? "Operational" : "Planned"}
                </span>
              </Row>
              <Row label="Compute">{stage.compute}</Row>
              <Row label="Replaces">{stage.replaces}</Row>
              <Row label="Ships">{stage.phase}</Row>
            </dl>

            {stage.status === "live" ? (
              <Button asChild className="w-full gap-2">
                <Link href="/alchemy">
                  Open the Alchemy Engine
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-3 text-xs leading-relaxed text-muted-foreground">
                Specified in ADR 0003 D1. This stage lands as a typed,
                independently-testable pipeline job in {stage.phase}.
              </p>
            )}
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
