"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useState, type MouseEvent } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type Edge,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import { STAGES, type PipelineStage } from "@/lib/command-center/pipeline";
import type {
  StageActivity,
  StageActivityMap,
} from "@/lib/command-center/overview";
import { BentoCard } from "@/components/ui/bento-card";
import { PipelineStageNode, type StageNode } from "./pipeline-stage-node";
import { ParticleEdge } from "./particle-edge";
import { StageDetailDialog } from "./stage-detail-dialog";

/* The pipeline river — the Command Center's hero surface (ADR 0003 D4).
   Six stage nodes, particle edges flowing source → target, click to drill in.
   Per-stage metric and operational status come from the live agent_runs
   counts in `stageActivity`. */

const nodeTypes: NodeTypes = { stage: PipelineStageNode };
const edgeTypes: EdgeTypes = { particle: ParticleEdge };

const COL_GAP = 248;
const ROW_Y = [24, 132];

export function PipelineRiver({
  stageActivity,
}: {
  stageActivity: StageActivityMap;
}) {
  const [selected, setSelected] = useState<
    { stage: PipelineStage; activity: StageActivity } | null
  >(null);

  const nodes = useMemo<StageNode[]>(
    () =>
      STAGES.map((stage, i) => {
        const activity = stageActivity[stage.id];
        return {
          id: stage.id,
          type: "stage",
          position: { x: i * COL_GAP, y: ROW_Y[i % 2] },
          data: {
            stage,
            metric:
              activity.runs > 0
                ? { value: String(activity.runs), label: stage.outputNoun }
                : null,
            activity,
          },
        };
      }),
    [stageActivity],
  );

  const edges = useMemo<Edge[]>(
    () =>
      STAGES.slice(1).map((stage, i) => ({
        id: `${STAGES[i].id}-${stage.id}`,
        source: STAGES[i].id,
        target: stage.id,
        type: "particle",
      })),
    [],
  );

  const onNodeClick = useCallback(
    (_: MouseEvent, node: StageNode) =>
      setSelected({ stage: node.data.stage, activity: node.data.activity }),
    [],
  );

  return (
    <BentoCard glow="lime" className="overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Pipeline river</h2>
          <p className="text-xs text-muted-foreground">
            Six stages, ingest to report — click a stage to inspect it.
          </p>
        </div>
        <span className="hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:block">
          ADR 0003 · D1
        </span>
      </header>

      <div className="h-[300px] w-full md:h-[340px]">
        <ReactFlow<StageNode, Edge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          colorMode="dark"
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.2}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          panOnDrag={false}
          panOnScroll={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
          style={{ background: "transparent" }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--border)"
          />
        </ReactFlow>
      </div>

      <StageDetailDialog
        stage={selected?.stage ?? null}
        activity={selected?.activity ?? null}
        onClose={() => setSelected(null)}
      />
    </BentoCard>
  );
}
