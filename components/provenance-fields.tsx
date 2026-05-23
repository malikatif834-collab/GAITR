import type { DecisionRecord } from "@/lib/db/schema";

/**
 * Reusable provenance body — extracted from `provenance-drawer.tsx` so
 * the /ops runs-explorer can drop it into the right pane next to an
 * `agent_runs` row without re-implementing the field grid.
 */
export function ProvenanceFields({
  decision,
}: {
  decision: Pick<
    DecisionRecord,
    | "agentName"
    | "promptVersion"
    | "modelId"
    | "createdAt"
    | "inputHash"
    | "outputHash"
    | "promptTokens"
    | "completionTokens"
    | "costUsd"
    | "modelParams"
    | "retrievalSources"
  >;
}) {
  return (
    <dl className="space-y-3 text-sm">
      <Field label="Agent" value={decision.agentName} mono />
      <Field label="Prompt version" value={decision.promptVersion} mono />
      <Field label="Model" value={decision.modelId} mono />
      <Field
        label="Created"
        value={new Date(decision.createdAt).toLocaleString()}
      />
      <Field label="Input hash" value={decision.inputHash} mono wrap />
      <Field
        label="Output hash"
        value={decision.outputHash ?? "—"}
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
