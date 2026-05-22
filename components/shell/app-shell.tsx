import { Sidebar } from "@/components/shell/sidebar";

/* App shell: grouped left sidebar + scrolling canvas. The grid leaves room for
   a right stat rail to be added as a third column in Phase 1 (Command Center),
   where it gets its first real content. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
      <Sidebar />
      <main className="min-w-0">{children}</main>
    </div>
  );
}
