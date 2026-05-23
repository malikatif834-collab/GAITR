import { BentoCard } from "@/components/ui/bento-card";
import { BigNumeric } from "@/components/ui/big-numeric";
import type { CommandCenterData } from "@/lib/command-center/overview";

/* Headline pipeline outputs. Pairs with KpiStrip — KpiStrip is the
   catalog (tools / patterns / scenarios / risk); this strip is the
   throughput of the five non-synthesize stages. */
export function PipelineOutputStrip({ data }: { data: CommandCenterData }) {
  const items = [
    {
      value: String(data.counts.incidents),
      label: "Real-world incidents",
      sublabel: "in the register",
    },
    {
      value: String(data.counts.fingerprints),
      label: "Attack fingerprints",
      sublabel: "from extract stage",
    },
    {
      value: String(data.counts.mappings),
      label: "SAIF mappings",
      sublabel: "from map stage",
    },
    {
      value: String(data.counts.briefs),
      label: "Analyst briefs",
      sublabel: "from report stage",
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
