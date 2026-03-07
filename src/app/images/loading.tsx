export default function ImagesLoading() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar skeleton */}
      <aside className="hidden md:flex w-72 shrink-0 flex-col border-r border-border p-4 gap-4">
        <div className="h-10 rounded-lg bg-surface animate-pulse" />
        <div className="h-10 rounded-lg bg-surface animate-pulse" />
        <div className="h-24 rounded-lg bg-surface animate-pulse" />
        <div className="h-10 rounded-lg bg-surface animate-pulse" />
        <div className="mt-auto h-12 rounded-lg bg-accent/10 animate-pulse" />
      </aside>
      {/* Main area skeleton */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-border px-6 py-3">
          <div className="h-8 w-48 rounded-lg bg-surface animate-pulse" />
        </div>
        <div className="flex-1 p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-surface animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
