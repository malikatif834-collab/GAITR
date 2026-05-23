import { BentoCard } from "@/components/ui/bento-card";
import { BigNumeric } from "@/components/ui/big-numeric";
import type { CommandCenterData } from "@/lib/command-center/overview";

/* Headline platform figures — oversized tabular numerics, the bento card's
   hero element (ADR 0003 D3). */
export function KpiStrip({ data }: { data: CommandCenterData }) {
  const items = [
    {
      value: String(data.counts.tools),
      label: "AI tools catalogued",
      sublabel: "in the register",
    },
    {
      value: String(data.counts.synergies),
      label: "Synergy patterns",
      sublabel: "capability combinations",
    },
    {
      value: String(data.counts.scenarios),
      label: "Scenarios synthesized",
      sublabel: "via the Alchemy Engine",
    },
    {
      value: `${data.peakRisk.toFixed(1)}×`,
      label: "Peak synergy risk",
      sublabel: "highest risk multiplier",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((it) => (
        <BentoCard key={it.label} className="p-5">
          <BigNumeric value={it.value} label={it.label} sublabel={it.sublabel} />
        </BentoCard>
      ))}
    </div>
  );
}
