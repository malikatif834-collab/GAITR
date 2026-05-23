import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

/* A pipeline edge with particles streaming source → target (ADR 0003 D4).
   Particles use the neon data palette, never lime — flow is data, not brand
   (ADR 0003 D3). The animateMotion `path` attribute follows the live edge
   geometry, so particles stay glued to the curve when nodes reflow. */

const PARTICLE_BEGINS = ["0s", "0.8s", "1.6s"];

export function ParticleEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: "var(--border)", strokeWidth: 2 }}
      />
      {PARTICLE_BEGINS.map((begin, i) => (
        <circle key={i} r={2.6} fill="var(--data-cyan)">
          <animateMotion
            dur="2.4s"
            begin={begin}
            repeatCount="indefinite"
            path={edgePath}
            calcMode="linear"
          />
        </circle>
      ))}
    </>
  );
}
