"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { BentoCard } from "@/components/ui/bento-card";

/* Per-stage quality scorecard. Three live metrics + two deferred
   placeholders (ADR 0005 D8). Reads /api/ops/eval. */

interface LiveMetric {
  id: string;
  stageId: string;
  metric: string;
  value: number;
  sampleSize: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  createdAt: string;
}

interface Sparkline {
  value: number;
  createdAt: string;
  sampleSize: number | null;
}

interface EvalPayload {
  live: LiveMetric[];
  sparklines: Record<string, Sparkline[]>;
  deferred: { metric: string; reason: string }[];
}

const METRIC_LABELS: Record<string, { title: string; sub: string }> = {
  "extract.fingerprint_coverage": {
    title: "Extract — fingerprint coverage",
    sub: "incidents-with-fingerprint ÷ incidents",
  },
  "correlate.capability_link_yield": {
    title: "Correlate — link yield",
    sub: "mean links per correlate run (24h)",
  },
  "map.controls_per_scenario": {
    title: "Map — controls per scenario",
    sub: "mean SAIF mappings per scenario (24h)",
  },
};

const METRIC_FORMAT: Record<string, (v: number) => string> = {
  "extract.fingerprint_coverage": (v) => `${(v * 100).toFixed(1)}%`,
  "correlate.capability_link_yield": (v) => v.toFixed(2),
  "map.controls_per_scenario": (v) => v.toFixed(2),
};

export function EvalScorecard() {
  const [data, setData] = useState<EvalPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ops/eval", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`eval fetch failed: ${r.status}`);
        return r.json() as Promise<EvalPayload>;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <BentoCard className="p-5 text-sm text-muted-foreground">
        Eval scorecard failed to load: {error}
      </BentoCard>
    );
  }
  if (!data) {
    return (
      <BentoCard className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading eval scorecard…
      </BentoCard>
    );
  }

  const liveByMetric = new Map(data.live.map((m) => [m.metric, m] as const));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {Object.keys(METRIC_LABELS).map((metric) => {
        const live = liveByMetric.get(metric);
        const spark = data.sparklines[metric] ?? [];
        return (
          <MetricCard
            key={metric}
            metric={metric}
            live={live}
            sparkline={spark}
          />
        );
      })}
      {data.deferred.map((d) => (
        <DeferredCard
          key={d.metric}
          metric={d.metric}
          reason={d.reason}
        />
      ))}
    </div>
  );
}

function MetricCard({
  metric,
  live,
  sparkline,
}: {
  metric: string;
  live: LiveMetric | undefined;
  sparkline: Sparkline[];
}) {
  const { title, sub } = METRIC_LABELS[metric];
  const fmt = METRIC_FORMAT[metric];
  return (
    <BentoCard className="flex flex-col p-5">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold tabular-nums">
          {live ? fmt(live.value) : "—"}
        </span>
        {live && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            n={live.sampleSize ?? 0}
          </span>
        )}
      </div>
      <div className="mt-3 h-[60px] w-full">
        {sparkline.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={sparkline.map((p, i) => ({ i, v: p.value }))}
              margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
            >
              <defs>
                <linearGradient id={`spark-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--data-cyan)"
                    stopOpacity={0.5}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--data-cyan)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis dataKey="i" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--data-cyan)"
                strokeWidth={1.5}
                fill={`url(#spark-${metric})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-[10px] text-muted-foreground">
            sparkline appears after 2 ticks
          </div>
        )}
      </div>
      {live?.windowEnd && (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          window ends {new Date(live.windowEnd).toLocaleString()}
        </p>
      )}
    </BentoCard>
  );
}

function DeferredCard({ metric, reason }: { metric: string; reason: string }) {
  return (
    <BentoCard className="flex flex-col p-5 opacity-60">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground">
          {metric}
        </h3>
        <p className="text-xs text-muted-foreground">
          Awaiting downstream data (ADR 0005 §D8)
        </p>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold tabular-nums text-muted-foreground">
          —
        </span>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {reason}
      </p>
    </BentoCard>
  );
}
