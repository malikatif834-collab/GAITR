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
import { BentoCard } from "@/components/ui/bento-card";
import { PipelineStageNode, type StageNode } from "./pipeline-stage-node";
import { ParticleEdge } from "./particle-edge";
import { StageDetailDialog } from "./stage-detail-dialog";

/* The pipeline river — the Command Center's hero surface (ADR 0003 D4).
   Six stage nodes, particle edges flowing source → target, click to drill in.
   The diagram is fixed: nodes are not draggable and scroll stays with the
   page; the only interaction is selecting a stage. */

const nodeTypes: NodeTypes = { stage: PipelineStageNode };
const edgeTypes: EdgeTypes = { particle: ParticleEdge };

const COL_GAP = 248;
const ROW_Y = [24, 132]; // gentle wave so the row reads as a flowing river

export function PipelineRiver({
  liveScenarioCount,
}: {
  liveScenarioCount: number;
}) {
  const [selected, setSelected] = useState<PipelineStage | null>(null);

  const nodes = useMemo<StageNode[]>(
    () =>
      STAGES.map((stage, i) => ({
        id: stage.id,
        type: "stage",
        position: { x: i * COL_GAP, y: ROW_Y[i % 2] },
        data: {
          stage,
          metric:
            stage.id === "synthesize"
              ? { value: String(liveScenarioCount), label: "scenarios" }
              : null,
        },
      })),
    [liveScenarioCount],
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
    (_: MouseEvent, node: StageNode) => setSelected(node.data.stage),
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

      <StageDetailDialog stage={selected} onClose={() => setSelected(null)} />
    </BentoCard>
  );
}
