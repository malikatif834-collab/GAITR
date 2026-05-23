import { BentoCard } from "@/components/ui/bento-card";
import { cn } from "@/lib/utils";

/* Shown on server-rendered pages when the database can't be reached
   (unset DATABASE_URL, unreachable host, missing tables). The platform
   keeps rendering with zero data; this banner is the actionable signal
   pointing the deployer at the Neon attach step. */
export function NoDatabaseBanner({ className }: { className?: string }) {
  return (
    <BentoCard
      className={cn(
        "border-okabe-orange/40 bg-okabe-orange/5 p-5",
        className,
      )}
      role="status"
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-okabe-orange">
        Demo mode — no database attached
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/90">
        The platform is rendering with zero data because no Postgres is
        reachable. To populate the register, attach Neon to the Vercel
        project (Storage → Neon Marketplace) and redeploy.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        See <code className="font-mono text-foreground">DEPLOY.md</code> in
        the repository for the one-click recipe and the manual import path.
      </p>
    </BentoCard>
  );
}
