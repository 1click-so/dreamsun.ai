import { Navbar } from "@/components/Navbar";

export default function ShotsLoading() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <Navbar />
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-surface" />
        <div className="h-8 w-24 animate-pulse rounded-lg bg-surface" />
        <div className="ml-auto h-8 w-20 animate-pulse rounded-lg bg-surface" />
      </div>
      {/* Content skeleton */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-surface" style={{ height: 280 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
