"use client";

import * as React from "react";
import { Search } from "lucide-react";
import type { AiTool } from "@/lib/db/schema";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ToolPicker({
  tools,
  selectedIds,
  onChange,
  className,
}: {
  tools: AiTool[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  className?: string;
}) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.vendor ?? "").toLowerCase().includes(q) ||
        t.capabilities.some((c) => c.toLowerCase().includes(q)),
    );
  }, [tools, query]);

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools, vendors, or capabilities…"
          className="pl-9"
          aria-label="Search tools"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {filtered.length} of {tools.length} tools
        </span>
        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className="font-medium text-foreground/80 hover:text-foreground"
          >
            Clear ({selectedIds.size})
          </button>
        )}
      </div>

      <ul
        className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto rounded-md border border-border bg-card/50 p-2"
        role="listbox"
        aria-label="AI tools"
        aria-multiselectable="true"
      >
        {filtered.length === 0 ? (
          <li className="px-3 py-8 text-center text-sm text-muted-foreground">
            No tools match &ldquo;{query}&rdquo;.
          </li>
        ) : (
          filtered.map((tool) => {
            const checked = selectedIds.has(tool.id);
            return (
              <li key={tool.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 transition-colors",
                    checked
                      ? "bg-secondary"
                      : "hover:bg-secondary/40",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(tool.id)}
                    aria-label={`Select ${tool.name}`}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium leading-tight">
                        {tool.name}
                      </span>
                      {tool.vendor && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {tool.vendor}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tool.capabilities.map((cap) => (
                        <Badge
                          key={cap}
                          variant="outline"
                          className="text-[10px] font-normal text-muted-foreground"
                        >
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </label>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
