"use client";

import { Navbar } from "@/components/Navbar";

export default function AudioPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4">
      <div className="text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/10">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            className="text-accent"
          >
            <path
              d="M9 18V5l12-2v13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>

        <h1 className="font-display text-2xl font-bold text-foreground">
          AI Audio Generation
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          Generate music, sound effects, and voiceovers with AI.
          We&apos;re building something special.
        </p>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-xs font-medium text-muted">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          Coming soon
        </div>
      </div>
    </div>
    </div>
  );
}
