export default function ShotsLoading() {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Nav skeleton */}
      <div className="border-b border-border px-5 py-3">
        <div className="h-8 w-48 rounded-lg bg-surface animate-pulse" />
      </div>
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <div className="h-8 w-32 rounded-lg bg-surface animate-pulse" />
        <div className="h-8 w-24 rounded-lg bg-surface animate-pulse" />
        <div className="ml-auto h-8 w-20 rounded-lg bg-surface animate-pulse" />
      </div>
      {/* Content skeleton */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface animate-pulse" style={{ height: 280 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
