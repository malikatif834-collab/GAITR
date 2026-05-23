import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/lib/command-center/pipeline";
import type { StageActivity } from "@/lib/command-center/overview";

export type StageNodeData = {
  stage: PipelineStage;
  /** Live throughput figure — present only for stages with real data. */
  metric: { value: string; label: string } | null;
  /** Full agent_runs activity for this stage, passed through to drill-in. */
  activity: StageActivity;
};

export type StageNode = Node<StageNodeData, "stage">;

const HANDLE_CLASS = "!h-1.5 !w-1.5 !border-0 !bg-border";

export function PipelineStageNode({ data, selected }: NodeProps<StageNode>) {
  const { stage, metric } = data;
  const live = stage.status === "live";

  return (
    <motion.div
      whileHover={{ scale: 1.04, y: -2 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={cn(
        "w-[188px] cursor-pointer rounded-xl border bg-card p-3 text-left",
        selected
          ? "border-primary ring-1 ring-primary"
          : "border-border hover:border-foreground/30",
      )}
    >
      <Handle type="target" position={Position.Left} className={HANDLE_CLASS} />

      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Stage {stage.order}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider",
            live ? "text-okabe-green" : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              live ? "bg-okabe-green" : "bg-muted-foreground/50",
            )}
          />
          {live ? "Live" : "Phase 2"}
        </span>
      </div>

      <p className="mt-1.5 text-sm font-semibold leading-tight">{stage.label}</p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
        {stage.blurb}
      </p>

      <div className="mt-2.5 flex items-end justify-between border-t border-border pt-2">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {stage.compute}
        </span>
        {metric && (
          <span className="flex items-baseline gap-1">
            <span className="font-mono text-base font-semibold leading-none tabular-nums">
              {metric.value}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {metric.label}
            </span>
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} className={HANDLE_CLASS} />
    </motion.div>
  );
}
