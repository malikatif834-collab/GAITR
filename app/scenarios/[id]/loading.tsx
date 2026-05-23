import { Skeleton } from "@/components/ui/skeleton";

export default function ScenarioDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
