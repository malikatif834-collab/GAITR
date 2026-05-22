import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type Glow = "none" | "lime" | "cyan" | "blue" | "violet" | "magenta" | "amber";

/* A glow is decorative card chrome only — it never encodes a data value
   (ADR 0003 D3: meaning rides the Okabe-Ito / neon scales, not card styling). */
const GLOW: Record<Glow, string> = {
  none: "",
  lime: "shadow-[0_0_60px_-20px_var(--primary)]",
  cyan: "shadow-[0_0_60px_-20px_var(--data-cyan)]",
  blue: "shadow-[0_0_60px_-20px_var(--data-blue)]",
  violet: "shadow-[0_0_60px_-20px_var(--data-violet)]",
  magenta: "shadow-[0_0_60px_-20px_var(--data-magenta)]",
  amber: "shadow-[0_0_60px_-20px_var(--data-amber)]",
};

export interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: Glow;
  asChild?: boolean;
}

export const BentoCard = React.forwardRef<HTMLDivElement, BentoCardProps>(
  ({ className, glow = "none", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp
        ref={ref}
        className={cn(
          "rounded-[var(--radius-bento)] border border-border bg-card text-card-foreground",
          GLOW[glow],
          className,
        )}
        {...props}
      />
    );
  },
);
BentoCard.displayName = "BentoCard";
