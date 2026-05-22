import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        404
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        That route doesn&rsquo;t exist.
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        The Alchemy Engine has three surfaces: the synthesis page, the
        scenarios list, and a scenario detail. Try one of those.
      </p>
      <div className="mt-6 flex gap-4 text-sm">
        <Link
          href="/"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Synthesize →
        </Link>
        <Link
          href="/scenarios"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Scenarios →
        </Link>
      </div>
    </div>
  );
}
