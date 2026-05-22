import { cn } from "@/lib/utils";

/* Oversized tabular-numeric hero figure — the bento card's headline element
   (ADR 0003 D3). */
export function BigNumeric({
  value,
  label,
  sublabel,
  className,
}: {
  value: React.ReactNode;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5", className)}>
      {label && (
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
      )}
      <p className="font-mono text-4xl font-semibold leading-none tracking-tight tabular-nums">
        {value}
      </p>
      {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
    </div>
  );
}
