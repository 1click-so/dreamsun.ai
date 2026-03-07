export function IconRegenerate() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 9a6 6 0 11-3-5.2" /><path d="M15 3v3h-3" />
    </svg>
  );
}

export function IconUpscale() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l4-4 3 3 5-5" /><path d="M11 5h4v4" />
    </svg>
  );
}

export function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2l5 5-9 9H2v-5z" /><path d="M9.5 3.5l5 5" />
    </svg>
  );
}

export function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3v9M5 8l4 4 4-4" /><path d="M3 14h12" />
    </svg>
  );
}

export function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="6" width="10" height="10" rx="2" /><path d="M4 12H3a1 1 0 01-1-1V3a1 1 0 011-1h8a1 1 0 011 1v1" />
    </svg>
  );
}

export function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
    >
      <path d="M3 4.5l3 3 3-3" />
    </svg>
  );
}

export function IconSparkle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C8.37 3.2 12.8 7.63 16 8c-3.2.37-7.63 4.8-8 8-.37-3.2-4.8-7.63-8-8C3.2 7.63 7.63 3.2 8 0z" />
    </svg>
  );
}

export function IconVideo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="3.5" width="11" height="11" rx="2" />
      <path d="M12.5 7.5l4-2v7l-4-2" />
    </svg>
  );
}

export function IconMotion({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9h12" />
      <path d="M12 5l4 4-4 4" />
      <circle cx="5" cy="5" r="2" />
      <circle cx="13" cy="13" r="2" />
    </svg>
  );
}
