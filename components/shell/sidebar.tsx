"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, Sparkles, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

/* Only live routes appear here — later interfaces join the nav in the phase
   that ships them (ADR 0003 build plan). */
const NAV = [
  { href: "/", label: "Synthesize", icon: Sparkles },
  { href: "/scenarios", label: "Scenarios", icon: Layers },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-card lg:flex">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <FlaskConical className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">GAITR</p>
          <p className="font-mono text-[10px] text-muted-foreground">
            Global AI Threat Register
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Alchemy Engine
        </p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-3">
        <p className="font-mono text-[10px] text-muted-foreground">
          v0.1 · Phase 0
        </p>
      </div>
    </aside>
  );
}
