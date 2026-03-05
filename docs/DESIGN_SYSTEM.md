# DreamSun.ai Design System

Single source of truth for all visual decisions.

---

## Color Tokens

Defined in `src/app/globals.css` as CSS custom properties. Referenced via Tailwind utilities.

| Token | Light | Dark | Tailwind Class |
|-------|-------|------|----------------|
| `background` | `#ffffff` | `#050505` | `bg-background`, `text-background` |
| `foreground` | `#171717` | `#ededed` | `text-foreground` |
| `surface` | `#f5f5f5` | `#111111` | `bg-surface` |
| `surface-hover` | `#ebebeb` | `#1a1a1a` | `bg-surface-hover` |
| `border` | `#e5e5e5` | `rgba(255,255,255,0.1)` | `border-border` |
| `accent` | `#A1FCDF` | `#A1FCDF` | `bg-accent`, `text-accent` |
| `accent-hover` | `#6EF0C3` | `#C8FEE9` | `bg-accent-hover` |
| `muted` | `#737373` | `#a3a3a3` | `text-muted` |
| `card` | `#f5f5f5` | `#111111` | `bg-card` |
| `destructive` | `#ef4444` | `#ef4444` | `text-destructive`, `bg-destructive` |

### Color Usage Rules

- **Never use hardcoded hex values** in components
- **Accent opacity steps**: `/5`, `/10`, `/20`, `/30`, `/50` only
- **Text on accent background**: Always `text-black`
- **Muted text opacity**: Use `text-muted` (not `text-white/60`)
- **Landing page exception**: `text-white/60`, `text-white/50`, `text-white/40` are allowed on the landing page only (pure dark bg, no theme switching)
- **Destructive actions**: Use `destructive` token, not `red-500`

---

## Typography

### Font Families

| Font | Variable | Tailwind | Usage |
|------|----------|----------|-------|
| Geist Sans | `--font-geist-sans` | `font-sans` | Body text, UI elements |
| Geist Mono | `--font-geist-mono` | `font-mono` | Code, monospace |
| Outfit | `--font-outfit` | `font-display` | Headings, logo, landing page |

### Font Scale (Tailwind)

| Context | Class | Where |
|---------|-------|-------|
| Page heading | `text-lg font-semibold` | Page headers |
| Section heading | `text-sm font-semibold uppercase tracking-wider` | Settings sections |
| Section divider | `text-lg font-bold uppercase tracking-widest` | Major separators |
| Body text | `text-sm` | General content |
| Small UI | `text-xs` | Buttons, labels, controls |
| Tiny UI | `text-[10px]` | Shot card inline labels |
| Micro UI | `text-[9px]` | Shot card sublabels |
| Landing hero | `text-6xl md:text-8xl lg:text-9xl font-bold` | Hero headline |
| Landing section | `text-4xl md:text-5xl font-bold` | Section headings |

### Font Weight

| Weight | Class | Usage |
|--------|-------|-------|
| Light | `font-light` | Landing page subtitle |
| Medium | `font-medium` | Labels, nav links, body |
| Semibold | `font-semibold` | UI headings, buttons |
| Bold | `font-bold` | Display headings, logo |

---

## Border Radius

Standardized scale — use Tailwind classes only.

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `sm` | 4px | `rounded-sm` | Micro elements (shot card selects) |
| `md` | 8px | `rounded-md` | Buttons, badges, nav links, history thumbs |
| `lg` | 12px | `rounded-lg` | Cards, inputs, textareas, dropdowns, modals |
| `xl` | 16px | `rounded-xl` | Command bar, main cards |
| `2xl` | 24px | `rounded-2xl` | Landing page gallery images, bento icon boxes |
| `3xl` | — | `rounded-3xl` | Landing bento feature cards |
| `full` | 9999px | `rounded-full` | Pills, badges, toggle tracks, landing CTAs |

### Rules

- **Inputs/Textareas**: Always `rounded-lg`
- **Buttons**: `rounded-lg` (app), `rounded-full` (landing CTAs)
- **Cards/Panels**: `rounded-lg` or `rounded-xl`
- **Thumbnails**: `rounded-md`
- **Modals**: `rounded-xl`

---

## Spacing

### Page Layout

| Area | Value |
|------|-------|
| Page horizontal padding | `px-6` |
| Page top padding | `py-3` (command areas), `py-8` (content) |
| Max content width | `max-w-7xl` |
| Landing section padding | `py-24 px-6 md:px-12` |

### Component Spacing

| Context | Value |
|---------|-------|
| Card padding | `p-4` (standard), `p-3` (compact) |
| Button padding | `px-3 py-2` (sm), `px-4 py-2` (md) |
| Input padding | `px-3 py-2` |
| Gap between items | `gap-2` (tight), `gap-3` (standard), `gap-4` (loose) |
| Section gap | `gap-6` or `gap-8` |
| Label to field | `mb-1.5` |

---

## Shadows

Minimal shadow usage — dark theme relies on borders.

| Usage | Class |
|-------|-------|
| Dropdown menus | `shadow-lg` |
| Everything else | No shadow (use borders) |

---

## Z-Index Scale

| Layer | Value | Usage |
|-------|-------|-------|
| Base content | `z-0` | Default |
| Overlapping content | `z-10` | Gallery gradient overlays |
| Gallery content | `z-20` | Gallery text above gradients |
| Dropdowns | `z-30` | CustomSelect dropdown |
| Fixed navbar | `z-50` | Landing navbar |
| Modals/Lightbox | `z-50` | Modals |
| Delete confirm | `z-[60]` | Stacked above lightbox |

---

## Components

All shared components live in `src/components/ui/`. Import via `@/components/ui`.

### Button

```tsx
import { Button } from "@/components/ui";

<Button variant="primary" size="sm">Generate</Button>
<Button variant="secondary" size="sm">Add Shot</Button>
<Button variant="ghost" size="sm">Settings</Button>
<Button variant="destructive" size="sm">Cancel</Button>
<Button variant="pill" size="lg">Generate Now</Button>
```

Variants: `primary`, `secondary`, `ghost`, `destructive`, `pill`
Sizes: `xs`, `sm`, `md`, `lg`

### Input

```tsx
import { Input } from "@/components/ui";

<Input placeholder="Enter value..." />
```

### Textarea

```tsx
import { Textarea } from "@/components/ui";

<Textarea rows={5} placeholder="Describe..." />
```

### Select

```tsx
import { Select } from "@/components/ui";

<Select
  value={selectedModel}
  options={[{ value: "flux", label: "FLUX", detail: "$0.03" }]}
  onChange={setSelectedModel}
/>
```

Custom dropdown with chevron animation. Replaces native `<select>` for styled dropdowns.

### Toggle

```tsx
import { Toggle } from "@/components/ui";

<Toggle checked={value} onChange={setValue} label="Safety Filter" />
<Toggle checked={value} onChange={setValue} label="Safety Checker" description="Filter NSFW content" />
```

### Badge

```tsx
import { Badge } from "@/components/ui";

<Badge variant="accent">Active</Badge>
<Badge variant="muted">Draft</Badge>
<Badge variant="live">DreamSun 2.0 is live</Badge>
```

### Card

```tsx
import { Card } from "@/components/ui";

<Card variant="surface">...</Card>
<Card variant="elevated">...</Card>
<Card variant="outlined">...</Card>
```

### Modal

```tsx
import { Modal } from "@/components/ui";

<Modal open={show} onClose={() => setShow(false)} size="lg">
  <h2>Title</h2>
  <p>Content</p>
</Modal>
```

Sizes: `sm` (320px), `md` (384px), `lg` (672px)

### Label

```tsx
import { Label } from "@/components/ui";

<Label size="md">Model</Label>
<Label size="sm" uppercase>Duration</Label>
```

### SectionDivider

```tsx
import { SectionDivider } from "@/components/ui";

<SectionDivider icon={<Film size={18} />} title="Shots" subtitle="12 shots" />
```

### Spinner

```tsx
import { Spinner } from "@/components/ui";

<Spinner size="sm" />  // xs, sm, md, lg
```

---

## Transition Standards

| Type | Class |
|------|-------|
| Default | `transition` (150ms) |
| Color change | `transition-colors` |
| Transform | `transition-transform` |
| Slow (hover effects) | `duration-500` |
| Landing animations | `duration-700` (gallery hover) |

---

## Active/Selected States

Consistent pattern for selected items (buttons, pills, tabs):

```
Selected:   border-accent/30 bg-accent/10 text-accent
Unselected: border-border bg-surface text-muted hover:border-accent/30
```

---

## File Structure

```
src/
  app/
    globals.css          -- Design tokens (CSS custom properties)
  types/
    shots.ts             -- Shot, ImageSettings, VideoSettings, UploadedRef types
  components/
    ui/
      index.ts           -- Barrel export
      Button.tsx         -- All button variants
      Input.tsx          -- Text input
      Textarea.tsx       -- Multi-line input
      Select.tsx         -- Custom dropdown
      Toggle.tsx         -- On/off switch
      Badge.tsx          -- Status indicators
      Card.tsx           -- Container panels
      Modal.tsx          -- Overlay dialogs
      Label.tsx          -- Form labels
      SectionDivider.tsx -- Section separators
      Spinner.tsx        -- Loading indicator
    shots/
      ShotCard.tsx       -- Full-width list view shot card
      StoryboardCard.tsx -- Compact storyboard view shot card
      Lightbox.tsx       -- Image/video preview modal
    Logo.tsx             -- DreamSun sun icon
    Navbar.tsx           -- App navigation bar
    landing/             -- Landing page components
  lib/
    cn.ts                -- clsx + tailwind-merge utility
```
