import { cn } from "@/lib/utils";
import type { SaifControl } from "@/lib/db/capabilities";

/**
 * SAIF control badge. Colors come from the Okabe-Ito palette (the `--okabe-*`
 * design tokens) so the six categories stay distinguishable for analysts with
 * color-vision deficiency.
 */
const SAIF_META: Record<SaifControl, { label: string; tone: string }> = {
  D: { label: "Data & Model Governance", tone: "bg-okabe-blue/15 text-okabe-blue ring-okabe-blue/40" },
  I: { label: "AI Infrastructure", tone: "bg-okabe-green/15 text-okabe-green ring-okabe-green/40" },
  M: { label: "ML Dev & Deployment", tone: "bg-okabe-yellow/15 text-okabe-yellow ring-okabe-yellow/40" },
  A: { label: "AI App Security", tone: "bg-okabe-orange/15 text-okabe-orange ring-okabe-orange/40" },
  AS: { label: "Autonomy & Safety", tone: "bg-okabe-vermilion/15 text-okabe-vermilion ring-okabe-vermilion/40" },
  G: { label: "Generative AI Trust", tone: "bg-okabe-purple/15 text-okabe-purple ring-okabe-purple/40" },
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
