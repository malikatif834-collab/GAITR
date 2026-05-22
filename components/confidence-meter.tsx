import { cn } from "@/lib/utils";

/**
 * v0.1 confidence is LLM-self-reported (or stub-computed). UI marks it as
 * uncalibrated so analysts don't read it as a probability. Calibration
 * lands in v0.3 (CRITIQUE.md B3).
 */
export function ConfidenceMeter({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const tone =
    value < 0.4
      ? "bg-okabe-vermilion"
      : value < 0.7
        ? "bg-okabe-orange"
        : "bg-okabe-green";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-mono font-medium text-foreground">
          {pct.toFixed(0)}%
        </span>
        <span
          className="text-muted-foreground"
          title="v0.1: confidence is model-reported (or stub-derived), not yet calibrated. Calibration lands in v0.3."
        >
          model-reported · uncalibrated
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
