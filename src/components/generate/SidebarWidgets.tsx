"use client";

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={`mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-foreground/60 ${className ?? ""}`}>
      {children}
    </label>
  );
}

export function PillButton({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[10px] font-medium transition ${
        active
          ? "border-accent/30 bg-accent/10 text-accent-text"
          : "border-border text-foreground/50 hover:border-accent/20 hover:text-foreground"
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
