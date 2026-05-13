import Link from "next/link";
import { FlaskConical } from "lucide-react";

export function SiteNav() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <FlaskConical className="h-4 w-4 text-foreground/80" />
          <span>Alchemy Engine</span>
          <span className="font-mono text-xs font-normal text-muted-foreground">
            · GAITR v0.1
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Synthesize
          </Link>
          <Link
            href="/scenarios"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Scenarios
          </Link>
        </nav>
      </div>
    </header>
  );
}
