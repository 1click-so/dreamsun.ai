/** Shimmer skeleton placeholder — matches the shape you give it via className */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-white/[0.06] ${className}`}
    />
  );
}
