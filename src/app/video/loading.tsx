import { Navbar } from "@/components/Navbar";

export default function VideoLoading() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar skeleton */}
        <aside className="hidden w-72 shrink-0 flex-col gap-4 border-r border-border p-4 md:flex">
          <div className="h-10 animate-pulse rounded-lg bg-surface" />
          <div className="h-10 animate-pulse rounded-lg bg-surface" />
          <div className="h-24 animate-pulse rounded-lg bg-surface" />
          <div className="h-10 animate-pulse rounded-lg bg-surface" />
          <div className="mt-auto h-12 animate-pulse rounded-lg bg-accent/10" />
        </aside>
        {/* Main area skeleton */}
        <div className="flex flex-1 flex-col">
          <div className="border-b border-border px-6 py-3">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-surface" />
          </div>
          <div className="flex-1 p-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-video animate-pulse rounded-xl bg-surface" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
