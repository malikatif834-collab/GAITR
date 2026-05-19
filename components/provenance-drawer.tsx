"use client";

import { ScrollText } from "lucide-react";
import type { DecisionRecord } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

/**
 * Surfaces the full decision-record provenance for any scenario.
 * Closes CRITIQUE.md B1 in the UI — the audit tuple is visible, not buried.
 */
export function ProvenanceDrawer({ decision }: { decision: DecisionRecord }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ScrollText className="h-3.5 w-3.5" />
          Show provenance
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decision provenance</DialogTitle>
          <DialogDescription>
            The reproducibility tuple for this scenario. Any future replay
            against the same prompt version and model should produce a
            semantically equivalent output.
          </DialogDescription>
        </DialogHeader>

        <Separator className="my-4" />

        <dl className="space-y-3 text-sm">
          <Field label="Agent" value={decision.agentName} mono />
          <Field label="Prompt version" value={decision.promptVersion} mono />
          <Field label="Model" value={decision.modelId} mono />
          <Field
            label="Created"
            value={new Date(decision.createdAt).toLocaleString()}
          />
          <Field
            label="Input hash"
            value={decision.inputHash}
            mono
            wrap
          />
          <Field
            label="Output hash"
            value={decision.outputHash}
            mono
            wrap
          />
          <Field
            label="Prompt tokens"
            value={(decision.promptTokens ?? 0).toLocaleString()}
            mono
          />
          <Field
            label="Completion tokens"
            value={(decision.completionTokens ?? 0).toLocaleString()}
            mono
          />
          <Field
            label="Cost"
            value={`$${Number(decision.costUsd ?? 0).toFixed(6)}`}
            mono
          />
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Model parameters
            </dt>
            <dd className="mt-1 rounded-md bg-muted/40 p-3 font-mono text-xs">
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(decision.modelParams, null, 2)}
              </pre>
            </dd>
          </div>
          {Boolean(decision.retrievalSources) && (
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                Retrieval sources
              </dt>
              <dd className="mt-1 rounded-md bg-muted/40 p-3 font-mono text-xs">
                <pre className="whitespace-pre-wrap break-all">
                  {JSON.stringify(decision.retrievalSources, null, 2)}
                </pre>
              </dd>
            </div>
          )}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  mono = false,
  wrap = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wrap?: boolean;
}) {
  return (
    <div className="grid grid-cols-[10rem_1fr] items-baseline gap-3">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          (mono ? "font-mono " : "") +
          "text-sm " +
          (wrap ? "break-all" : "truncate")
        }
      >
        {value}
      </dd>
    </div>
  );
}
