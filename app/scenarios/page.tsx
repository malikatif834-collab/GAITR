import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alchemyScenarios } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { BentoCard } from "@/components/ui/bento-card";
import { SaifBadge } from "@/components/saif-badge";
import type { SaifControl } from "@/lib/db/capabilities";

export const dynamic = "force-dynamic";

export default async function ScenariosPage() {
  const rows = await db
    .select()
    .from(alchemyScenarios)
    .orderBy(desc(alchemyScenarios.createdAt))
    .limit(50);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 space-y-1">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          GAITR · Alchemy Engine
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Recent scenarios
        </h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} scenario{rows.length === 1 ? "" : "s"} synthesized so far. Click any to inspect
          the narrative, mitigations, and decision provenance.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No scenarios yet.{" "}
          <Link href="/" className="font-medium text-foreground hover:underline">
            Synthesize your first one →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((s) => {
            const saif = s.saifControls as SaifControl[];
            return (
              <li key={s.id}>
                <BentoCard
                  asChild
                  className="block p-4 transition-colors hover:border-foreground/30"
                >
                  <Link href={`/scenarios/${s.id}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="truncate text-sm font-medium">
                      {s.emergentCapabilities.join(" · ")}
                    </h2>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {s.narrative}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {saif.map((c) => (
                      <SaifBadge key={c} control={c} />
                    ))}
                    <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                      confidence {Number(s.confidence).toFixed(2)}
                    </Badge>
                  </div>
                  </Link>
                </BentoCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
