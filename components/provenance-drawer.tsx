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
import { ProvenanceFields } from "@/components/provenance-fields";

/**
 * Surfaces the full decision-record provenance for any scenario.
 * Closes CRITIQUE.md B1 in the UI — the audit tuple is visible, not buried.
 * Body extracted to `components/provenance-fields.tsx` so the ops
 * runs-explorer (ADR 0005 D5) can drop the same fields inline.
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

        <ProvenanceFields decision={decision} />
      </DialogContent>
    </Dialog>
  );
}
