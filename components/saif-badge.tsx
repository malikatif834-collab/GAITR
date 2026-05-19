import { cn } from "@/lib/utils";
import type { SaifControl } from "@/lib/db/capabilities";

/**
 * SAIF control badge. Colors chosen from the Okabe-Ito palette so the six
 * categories remain distinguishable for analysts with color-vision deficiency.
 */
const SAIF_META: Record<SaifControl, { label: string; tone: string }> = {
  D: { label: "Data & Model Governance", tone: "bg-[#56B4E9]/15 text-[#56B4E9] ring-[#56B4E9]/40" },
  I: { label: "AI Infrastructure", tone: "bg-[#009E73]/15 text-[#33B68F] ring-[#009E73]/40" },
  M: { label: "ML Dev & Deployment", tone: "bg-[#F0E442]/15 text-[#E5D43A] ring-[#F0E442]/40" },
  A: { label: "AI App Security", tone: "bg-[#E69F00]/15 text-[#E69F00] ring-[#E69F00]/40" },
  AS: { label: "Autonomy & Safety", tone: "bg-[#D55E00]/15 text-[#E07A2B] ring-[#D55E00]/40" },
  G: { label: "Generative AI Trust", tone: "bg-[#CC79A7]/15 text-[#D58FBA] ring-[#CC79A7]/40" },
};

export function SaifBadge({
  control,
  showLabel = false,
  className,
}: {
  control: SaifControl;
  showLabel?: boolean;
  className?: string;
}) {
  const meta = SAIF_META[control];
  return (
    <span
      title={meta.label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        meta.tone,
        className,
      )}
    >
      <span className="font-mono font-semibold">{control}</span>
      {showLabel && <span className="text-foreground/80">{meta.label}</span>}
    </span>
  );
}

export { SAIF_META };
