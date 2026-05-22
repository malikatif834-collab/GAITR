"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BentoCard } from "@/components/ui/bento-card";
import { cn } from "@/lib/utils";

/* Synthesis activity over the trailing two weeks — a Recharts trend chart
   (ADR 0003 D4). The series rides the neon data palette. */
export function ThreatAnalytics({
  series,
  className,
}: {
  series: { date: string; count: number }[];
  className?: string;
}) {
  const total = series.reduce((sum, d) => sum + d.count, 0);
  const data = series.map((d) => ({ ...d, label: formatDay(d.date) }));

  return (
    <BentoCard className={cn("flex flex-col p-5", className)}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Threat analytics</h2>
          <p className="text-xs text-muted-foreground">
            Synthesis activity, last 14 days
          </p>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {total} total
        </span>
      </div>

      <div className="h-[184px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: -22 }}>
            <defs>
              <linearGradient id="ta-fill" x1="0" y1="0" x2="0" y2="1">
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
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              allowDecimals={false}
              width={30}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--muted-foreground)" }}
              itemStyle={{ color: "var(--foreground)" }}
            />
            <Area
              type="monotone"
              dataKey="count"
              name="Scenarios"
              stroke="var(--data-cyan)"
              strokeWidth={2}
              fill="url(#ta-fill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </BentoCard>
  );
}

function formatDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}
