import Link from "next/link";
import { BentoCard } from "@/components/ui/bento-card";
import { SaifBadge } from "@/components/saif-badge";
import { cn } from "@/lib/utils";
import type { SpotlightScenario } from "@/lib/command-center/overview";

/* Most recent synthesized scenarios — the platform's freshest intelligence. */
export function IntelligenceSpotlight({
  scenarios,
  className,
}: {
  scenarios: SpotlightScenario[];
  className?: string;
}) {
  return (
    <BentoCard className={cn("flex flex-col p-5", className)}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Intelligence spotlight</h2>
          <p className="text-xs text-muted-foreground">
            Latest synthesized threat scenarios
          </p>
        </div>
        {scenarios.length > 0 && (
          <Link
            href="/scenarios"
            className="shrink-0 text-xs font-medium text-link hover:underline"
          >
            All scenarios →
          </Link>
        )}
      </div>

      {scenarios.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <span>
            No scenarios yet.{" "}
            <Link href="/alchemy" className="text-foreground hover:underline">
              Synthesize one →
            </Link>
          </span>
        </div>
      ) : (
        <ul className="space-y-2">
          {scenarios.map((s) => (
            <li key={s.id}>
              <Link
                href={`/scenarios/${s.id}`}
                className="block rounded-lg border border-border bg-card p-3 transition-colors hover:border-foreground/30"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="truncate text-sm font-medium">{s.title}</h3>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {timeAgo(s.createdAt)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {s.narrative}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {s.saifControls.map((c) => (
                    <SaifBadge key={c} control={c} />
                  ))}
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    conf {s.confidence.toFixed(2)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
