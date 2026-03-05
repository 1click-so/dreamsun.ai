import { Sun } from "lucide-react";

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg bg-accent"
      style={{ width: size + 8, height: size + 8 }}
    >
      <Sun size={size} className="text-black" strokeWidth={2} />
    </div>
  );
}
