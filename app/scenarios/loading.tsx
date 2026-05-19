import { Skeleton } from "@/components/ui/skeleton";

export default function ScenariosLoading() {
  return (
    <main className="container mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <ul className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i}>
            <Skeleton className="h-24" />
          </li>
        ))}
      </ul>
    </main>
  );
}
