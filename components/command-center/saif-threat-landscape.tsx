"use client";

import { scaleLinear } from "d3";
import { Group } from "@visx/group";
import { Line } from "@visx/shape";
import { LinearGradient } from "@visx/gradient";
import { BentoCard } from "@/components/ui/bento-card";
import { cn } from "@/lib/utils";
import type { SaifControl } from "@/lib/db/capabilities";

/* SAIF threat landscape — a visx radar over the six SAIF control
   categories. Each axis is one category, the polygon is how many
   synthesized scenarios touch it. Axis colours follow the Okabe-Ito
   scale shared with SaifBadge; the polygon rides the neon data
   palette — meaning never rides lime (ADR 0003 D3). */

const SAIF_LABEL: Record<SaifControl, string> = {
  D: "Data & Model Governance",
  I: "AI Infrastructure",
  M: "ML Dev & Deployment",
  A: "AI App Security",
  AS: "Autonomy & Safety",
  G: "Generative AI Trust",
};

const SAIF_COLOR: Record<SaifControl, string> = {
  D: "var(--okabe-blue)",
  I: "var(--okabe-green)",
  M: "var(--okabe-yellow)",
  A: "var(--okabe-orange)",
  AS: "var(--okabe-vermilion)",
  G: "var(--okabe-purple)",
};

const SIZE = 232;
const C = SIZE / 2;
const R = 78;
const RINGS = [0.25, 0.5, 0.75, 1];

export function SaifThreatLandscape({
  distribution,
  className,
}: {
  distribution: { control: SaifControl; count: number }[];
  className?: string;
}) {
  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  const max = Math.max(1, ...distribution.map((d) => d.count));
  const radius = scaleLinear().domain([0, max]).range([0, R]);
  const n = distribution.length;

  const vertex = (i: number, rad: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: C + rad * Math.cos(angle), y: C + rad * Math.sin(angle) };
  };
  const polygon = (radAt: (i: number) => number) =>
    distribution
      .map((_, i) => {
        const p = vertex(i, radAt(i));
        return `${p.x},${p.y}`;
      })
      .join(" ");

  return (
    <BentoCard className={cn("flex flex-col p-5", className)}>
      <div className="mb-3">
        <h2 className="text-sm font-semibold">SAIF threat landscape</h2>
        <p className="text-xs text-muted-foreground">
          Scenario coverage across the six SAIF control categories
        </p>
      </div>

      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No SAIF mappings yet — synthesize a scenario to populate the
          landscape.
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-4 sm:flex-row">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="h-auto w-full max-w-[212px] shrink-0"
            role="img"
            aria-label="SAIF control coverage radar"
          >
            <LinearGradient
              id="saif-radar"
              from="var(--data-violet)"
              to="var(--data-blue)"
              fromOpacity={0.55}
              toOpacity={0.18}
            />
            <Group>
              {RINGS.map((ring) => (
                <polygon
                  key={ring}
                  points={polygon(() => R * ring)}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth={1}
                />
              ))}
              {distribution.map((d, i) => (
                <Line
                  key={d.control}
                  from={{ x: C, y: C }}
                  to={vertex(i, R)}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
              ))}
              <polygon
                points={polygon((i) => radius(distribution[i].count))}
                fill="url(#saif-radar)"
                stroke="var(--data-violet)"
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {distribution.map((d, i) => {
                const p = vertex(i, radius(d.count));
                return (
                  <circle
                    key={d.control}
                    cx={p.x}
                    cy={p.y}
                    r={3}
                    fill="var(--data-violet)"
                  />
                );
              })}
              {distribution.map((d, i) => {
                const p = vertex(i, R + 15);
                return (
                  <text
                    key={d.control}
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="font-mono"
                    fontSize={11}
                    fontWeight={700}
                    fill={SAIF_COLOR[d.control]}
                  >
                    {d.control}
                  </text>
                );
              })}
            </Group>
          </svg>

          <ul className="w-full space-y-1.5">
            {distribution.map((d) => (
              <li key={d.control} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ background: SAIF_COLOR[d.control] }}
                />
                <span
                  className="font-mono font-semibold"
                  style={{ color: SAIF_COLOR[d.control] }}
                >
                  {d.control}
                </span>
                <span className="truncate text-muted-foreground">
                  {SAIF_LABEL[d.control]}
                </span>
                <span className="ml-auto font-mono tabular-nums">
                  {d.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BentoCard>
  );
}
