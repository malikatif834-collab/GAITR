export default function Home() {
  return (
    <main className="container mx-auto max-w-4xl px-6 py-16">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          GAITR · v0.1 scaffold
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Alchemy Engine
        </h1>
        <p className="text-lg text-muted-foreground">
          Threat scenario synthesis from AI tool combinations, mapped to SAIF.
        </p>
      </header>

      <section className="mt-12 grid gap-4 rounded-lg border border-border bg-card p-6 text-card-foreground">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Build status
        </h2>
        <p className="text-sm leading-relaxed">
          Scaffold only. Schema, matcher, synthesizer, and UI land in
          subsequent commits per ADR&nbsp;0002.
        </p>
      </section>
    </main>
  );
}
