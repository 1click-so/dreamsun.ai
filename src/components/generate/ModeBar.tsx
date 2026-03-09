"use client";

export interface ModeConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  ready: boolean;
  /** Whether this mode uses the floating prompt bar. Defaults to true. */
  hasPrompt?: boolean;
}

interface ModeBarProps {
  modes: ModeConfig[];
  active: string;
  onChange: (id: string) => void;
  /** Number of grid columns. Defaults to number of modes, max 4. */
  columns?: number;
}

export function ModeBar({ modes, active, onChange, columns }: ModeBarProps) {
  const cols = columns ?? Math.min(modes.length, 4);
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => mode.ready ? onChange(mode.id) : undefined}
          className={`group relative flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${
            active === mode.id
              ? "bg-accent/10 ring-1 ring-accent/25"
              : mode.ready
                ? "bg-surface hover:bg-surface-hover"
                : "cursor-default bg-surface/50"
          }`}
          title={mode.ready ? mode.description : `${mode.label} — coming soon`}
        >
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
            active === mode.id
              ? "bg-accent/20 text-accent-text"
              : mode.ready
                ? "bg-surface-hover text-muted group-hover:text-foreground"
                : "text-muted/25"
          }`}>
            {mode.icon}
          </span>
          <span className={`text-[11px] font-semibold leading-tight ${
            active === mode.id
              ? "text-accent-text"
              : mode.ready
                ? "text-foreground/70 group-hover:text-foreground"
                : "text-muted/30"
          }`}>
            {mode.label}
          </span>
          {!mode.ready && (
            <span className="absolute top-1.5 right-1.5 rounded-md bg-surface-hover px-1 py-px text-[7px] font-bold uppercase text-muted/40">
              Soon
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Placeholder content shown when a non-ready mode is selected */
export function ModeComingSoon({ mode }: { mode: ModeConfig }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-hover text-muted">
        {mode.icon}
      </div>
      <p className="text-sm font-semibold text-foreground">
        {mode.label}
      </p>
      <p className="mt-1 text-[11px] text-muted">
        {mode.description}
      </p>
      <span className="mt-3 rounded-full bg-accent/10 px-3 py-1 text-[10px] font-semibold text-accent-text">
        Coming soon
      </span>
    </div>
  );
}
