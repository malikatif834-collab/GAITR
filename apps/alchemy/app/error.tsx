"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[alchemy] unhandled error:", error);
  }, [error]);

  return (
    <main className="container mx-auto max-w-2xl px-6 py-24">
      <p className="font-mono text-xs uppercase tracking-widest text-destructive">
        Something went wrong
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        The synthesizer hit an error.
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      {error.digest && (
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          Digest: {error.digest}
        </p>
      )}
      <div className="mt-6">
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </main>
  );
}
