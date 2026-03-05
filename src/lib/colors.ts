/**
 * DreamSun AI — Design Token Reference
 *
 * Single accent color system. One color, two button styles.
 *
 * PALETTE:
 *   --accent:       #A1FCDF  (mint green — THE brand color)
 *   --accent-hover: #6EF0C3  (light mode hover — slightly deeper)
 *   --accent-hover: #C8FEE9  (dark mode hover — slightly lighter)
 *
 * USAGE:
 *   Shot number badge    → bg-accent/10 text-accent
 *   Image label          → text-accent
 *   Video label          → text-accent
 *   More button (active) → border-accent/50 bg-accent/10 text-accent
 *   Generating indicator → text-accent + bg-accent pulse
 *   Busy glow            → border-accent/60 shadow-accent/20
 *
 * BUTTON STYLES:
 *   Primary (filled):    bg-accent text-black hover:bg-accent-hover
 *     Used for: Generate, Regenerate
 *
 *   Secondary (outline):  border border-accent text-accent hover:bg-accent/10
 *     Used for: Animate, Re-animate
 *
 * NEUTRALS:
 *   --background:    #ffffff / #0a0a0a
 *   --foreground:    #171717 / #ededed
 *   --surface:       #f5f5f5 / #171717
 *   --surface-hover: #ebebeb / #262626
 *   --border:        #e5e5e5 / #262626
 *   --muted:         #737373 / #a3a3a3
 *
 * RULES:
 *   - Nav/chrome: neutral only (foreground, muted, border)
 *   - Inside shot cards: accent color for all interactive elements
 *   - Output column (First/Last/Video): neutral gray
 *   - Errors: red-500/red-400 (semantic, not branded)
 *   - Success: green-500 (semantic, not branded)
 */

export const COLORS = {
  accent: "#A1FCDF",
  accentHoverLight: "#6EF0C3",
  accentHoverDark: "#C8FEE9",
} as const;
