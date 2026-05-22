import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";
import type { AlchemyScenario, AiTool, CapabilitySynergy } from "@/lib/db/schema";
import { CardContent, CardHeader } from "@/components/ui/card";
import { BentoCard } from "@/components/ui/bento-card";
import { Badge } from "@/components/ui/badge";
import { SaifBadge } from "@/components/saif-badge";
import { ConfidenceMeter } from "@/components/confidence-meter";
import type { SaifControl, Capability } from "@/lib/db/capabilities";

interface Mitigation {
  control: SaifControl;
  action: string;
  rationale: string;
}

export function ScenarioCard({
  scenario,
  tools,
  matchedPatterns,
  detailHref,
  rightSlot,
}: {
  scenario: AlchemyScenario;
  tools?: AiTool[];
  matchedPatterns?: CapabilitySynergy[];
  detailHref?: string;
  rightSlot?: React.ReactNode;
}) {
  const mitigations = (scenario.mitigations as Mitigation[]) ?? [];
  const saif = scenario.saifControls as SaifControl[];

  return (
    <BentoCard>
      <CardHeader className="space-y-3 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Scenario · {new Date(scenario.createdAt).toLocaleString()}
            </p>
            <h2 className="text-lg font-semibold leading-tight">
              {scenario.emergentCapabilities.join(" · ")}
            </h2>
          </div>
          {rightSlot}
        </div>
        <ConfidenceMeter value={Number(scenario.confidence)} />
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        <p className="text-sm leading-relaxed text-foreground/90">
          {scenario.narrative}
        </p>

        {tools && tools.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tool combination
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {tools.map((t) => (
                <Badge key={t.id} variant="secondary">
                  {t.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {matchedPatterns && matchedPatterns.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Matched synergy patterns
            </h3>
            <ul className="space-y-1.5 text-sm">
              {matchedPatterns.map((p) => (
                <li
                  key={p.id}
                  className="flex items-baseline justify-between gap-3 rounded-md bg-secondary/30 px-3 py-1.5"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {Number(p.riskMultiplier).toFixed(1)}×
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            SAIF mitigations
          </h3>
          <ul className="space-y-2">
            {mitigations.map((m, idx) => (
              <li
                key={idx}
                className="grid grid-cols-[auto_1fr] gap-3 rounded-md border border-border bg-card/60 p-3 text-sm"
              >
                <SaifBadge control={m.control} />
                <div className="space-y-1">
                  <p className="leading-snug">{m.action}</p>
                  <p className="text-xs text-muted-foreground">{m.rationale}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-xs text-muted-foreground">
            SAIF categories:
          </span>
          {saif.map((c) => (
            <SaifBadge key={c} control={c} showLabel />
          ))}
        </div>

        {detailHref && (
          <Link
            href={detailHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-foreground/80 transition-colors hover:text-foreground"
          >
            Open scenario detail
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </CardContent>
    </BentoCard>
  );
}
