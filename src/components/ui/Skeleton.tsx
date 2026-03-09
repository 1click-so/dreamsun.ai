/** Smooth shimmer skeleton — continuous gradient sweep, no pauses */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`skeleton-shimmer rounded-md ${className}`}
    />
  );
}
