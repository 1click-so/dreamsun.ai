# DreamSun UX Navigation Blueprint

**Status:** Discussion / Exploration
**Date:** 2026-03-07
**Context:** DreamSun is evolving from a simple image/video generator into a multi-tool creative platform. The current top-nav architecture won't scale. This document captures the research, analysis, and proposed direction.

---

## 1. Current State

### Navigation
- **Top navbar:** `DreamSun | Images | Videos | Shots [New]`
- No sidebar
- No profile/account UI
- No unified gallery
- No project/workspace concept

### Pages
| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/generate` | Image generation (prompt + settings + history) |
| `/video` | Video generation (separate page) |
| `/shots` | Scenes overview |
| `/shots/[sceneId]` | Shot list editor inside a scene |
| `/login` | Auth (sign in, sign up, forgot password) |

### Problems
1. **Images and Videos are separate pages** — but they're the same action (generate content)
2. **No unified gallery** — no way to see all your creations in one place
3. **Top nav doesn't scale** — adding Upscale, Voice, Lip-Sync, Edit Image, Edit Video would crowd the navbar
4. **No profile/account section** — can't sign out, see account info, manage settings
5. **No project/workspace organization** — all generations are flat, no grouping

---

## 2. Competitive Analysis

### Freepik (freepik.com/pikaso)

**Layout:**
- Collapsible left sidebar with generation tools (icons)
- Top bar: project/workspace selector + Community/Templates/Tutorials tabs
- Main area: unified masonry grid of ALL generations (images + videos mixed)
- Internal tabs at sidebar top: Image | Video | Audio

**Key patterns:**
- One generator page, mode tabs switch between image/video/audio
- Sidebar collapses to icons only, expands on hover or click
- Nav items are "pinnable" — users customize which tools appear
- "Personal project" dropdown in top bar for workspace context
- No separate pages for image vs video — everything unified

**Strengths:** Clean, scalable, unified history
**Weaknesses:** Sidebar can feel cramped for complex settings

---

### OpenArt (openart.ai)

**Layout:**
```
[Logo | Workspace ▾ |              | Credits | Icons | Upgrade | Avatar]
┌──────────┬──────────────┬─────────────────────────────────────────────┐
│ All Tools│  Tool Panel   │  Creations | Collections                   │
│          │  (controls)   │                                            │
│ Pinned:  │  Model: Z-Img │  [masonry grid of all generations]         │
│ Create   │  Upload area  │                                            │
│ Frame2Vid│  Prompt       │                                            │
│ Txt2Vid  │  Settings     │                                            │
│ MotionSyn│  [Generate]   │                                            │
│ Lip-Sync │              │                                            │
│ Edit Img │  Image | Vid  │                                            │
│ Edit Vid │  (mode tabs)  │                                            │
└──────────┴──────────────┴─────────────────────────────────────────────┘
```

**Three-column layout:**
1. **Slim sidebar** (always visible) — tool list with icons + labels, "Pinned" section, "Add Tools"
2. **Tool panel** (collapsible middle) — active tool's controls, settings, prompt, generate button
3. **Main area** (right) — always shows creations grid, with Creations/Collections tabs

**Key patterns:**
- Sidebar is ALWAYS visible (not collapsible) — it's the primary navigation
- Tool panel IS collapsible — it's the active tool's controls
- Top bar is minimal: logo, workspace name, credits, profile
- "Creations" and "Collections" tabs above the main grid
- Grid has size slider and filter icons
- Each tool is a self-contained panel with its own sub-tabs

**Strengths:** Very scalable, clear separation of navigation vs controls
**Weaknesses:** Three columns can be tight on smaller screens

---

### Higgsfield

- Separate image and video generators
- No unified gallery
- Simpler tool, fewer features
- Not a good reference for scalability

---

## 3. Proposed DreamSun Architecture

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DreamSun  │  Creations  Collections  │  Project ▾    💎 40   ⚙   👤  │
├──────┬──────────────────────────────────────────────────────────────────┤
│      │                                                                  │
│  🎨  │                                                                  │
│Create│            Main content area                                     │
│      │                                                                  │
│  🎬  │   (changes based on sidebar selection + top bar context)         │
│Shots │                                                                  │
│      │                                                                  │
│──────│   When "Create" active + "Creations" tab:                        │
│      │   → Unified generation grid (images + videos)                    │
│  ⬆️  │                                                                  │
│Upscl │   When "Create" active + tool panel open:                        │
│      │   → Tool controls on left, grid on right                         │
│  🎤  │                                                                  │
│Voice │   When "Shots" active:                                           │
│      │   → Scene overview or shot list editor                           │
│  ✂️  │                                                                  │
│LipSy │                                                                  │
│      │                                                                  │
└──────┴──────────────────────────────────────────────────────────────────┘
```

### Top Bar

| Zone | Content |
|------|---------|
| **Left** | DreamSun logo |
| **Center-left** | Context tabs: "Creations" / "Collections" (like OpenArt) |
| **Center** | Project/workspace selector dropdown |
| **Right** | Credits display, settings gear, profile avatar dropdown |

The context tabs change meaning based on the active tool:
- **Create:** Creations = generation gallery, Collections = saved/organized groups
- **Shots:** Could show "Scenes" / "All Shots" or just hide the tabs

### Sidebar

Slim, always visible. Icon + short label for each tool.

**Current tools:**
| Icon | Label | Route/Action |
|------|-------|-------------|
| 🎨 | Create | `/create` — unified image + video generation |
| 🎬 | Shots | `/shots` — scene/shot production pipeline |

**Future tools (planned):**
| Icon | Label | Description |
|------|-------|-------------|
| ⬆️ | Upscale | Image upscaling (fal.ai models) |
| 🎤 | Voice | Voice generation (ElevenLabs API) |
| 👄 | Lip-Sync | Lip-sync video to audio |
| ✏️ | Edit Image | Inpainting, outpainting, style transfer |
| ✂️ | Edit Video | Video editing tools |
| 🔊 | Audio | Sound effects, music generation |

**Sidebar behavior:**
- Always visible on desktop
- Collapsible to icon-only on smaller screens (or by user preference)
- Active tool highlighted with accent color
- Possible "Pin/Unpin" system for power users (future)

### Unified Create Page (`/create`)

Replaces both `/generate` and `/video`.

**Sub-layout:**
```
┌──────────────────┬─────────────────────────────────────┐
│   Tool Panel     │                                     │
│   (collapsible)  │   Generation History Grid           │
│                  │   (masonry, chronological)           │
│  [Image] [Video] │                                     │
│                  │   Shows ALL generations:             │
│  Model: ▾       │   - Images                           │
│  Prompt: ___    │   - Videos                           │
│  Settings...    │   - Mixed together                   │
│                  │   - Filterable by type               │
│  [Generate ✨]  │                                     │
│                  │   Click any item → expand/lightbox   │
└──────────────────┴─────────────────────────────────────┘
```

**Mode tabs (bottom or top of tool panel):**
- **Image** — shows image generation controls (model, prompt, aspect ratio, refs, etc.)
- **Video** — shows video generation controls (model, prompt, duration, etc.)

**Generation history grid:**
- Pulls from `generations` table in Supabase
- Masonry layout, mixed images + videos
- Date headers ("Today", "Yesterday", "March 5")
- Filter buttons: All | Images | Videos
- Size slider for grid items
- Click → lightbox with details, prompt, re-generate, add to shots

### Shots Page (`/shots`, `/shots/[sceneId]`)

Stays largely the same but inside the new shell layout. The sidebar shows "Shots" as active. Top bar context tabs could show "Scenes" / "All Shots" or be hidden.

### Profile Dropdown

Triggered by avatar in top bar right side.

**Contents:**
- User email / name
- Account settings link
- Theme toggle (if needed)
- Sign out button
- Usage/credits info

---

## 4. Migration Strategy

### Phase 1: App Shell
- Build the new layout wrapper: sidebar + top bar + main content area
- Move existing pages inside the shell
- Sidebar has just "Create" and "Shots" for now
- No functional changes — just layout migration

### Phase 2: Unified Create Page
- Merge `/generate` and `/video` into `/create`
- Add Image/Video mode tabs in tool panel
- Build generation history grid (reads from `generations` table)
- Tool panel is collapsible

### Phase 3: Profile & Workspace
- Profile dropdown in top bar
- Project/workspace selector (if multi-project needed)
- Collections feature (save/organize generations)

### Phase 4: New Tools
- Add sidebar entries as tools are built
- Each tool gets its own tool panel
- Main area adapts per tool

---

## 5. Open Questions

1. **Collapsible sidebar or always visible?**
   - OpenArt: always visible (slim)
   - Freepik: collapsible (icon-only when collapsed)
   - Recommendation: Always visible on desktop, collapsible on tablet/mobile

2. **Tool panel position?**
   - OpenArt: separate middle column
   - Freepik: inside the sidebar (sidebar expands)
   - Could also be: overlay panel that slides out from sidebar
   - Recommendation: Separate panel (like OpenArt) — gives more space for controls

3. **Top bar context tabs — always visible?**
   - "Creations" / "Collections" make sense for Create tool
   - For Shots, different context (Scenes / Shot List)
   - Could hide context tabs when not relevant
   - Or make them global: "Creations" always shows the gallery

4. **Project/workspace — needed now?**
   - Adds complexity
   - Single workspace is fine for MVP
   - But the UI slot should exist (placeholder or "Personal" default)

5. **Credits system — needed now?**
   - DreamSun uses fal.ai which has API costs
   - Could track credits/usage
   - Not critical for MVP but the top bar slot should exist

6. **Mobile layout?**
   - Sidebar collapses to hamburger menu or bottom tab bar?
   - Tool panel becomes full-screen overlay?
   - Not critical now but worth considering

7. **Should the generation history grid be global or per-tool?**
   - OpenArt: global (all creations in one grid)
   - Could filter by tool type
   - Recommendation: Global grid, filterable

---

## 6. Design Tokens for New Layout

These would extend the existing design system:

```
Sidebar:
  width-expanded: 200px
  width-collapsed: 56px (icon only)
  background: var(--surface) or slightly darker
  border-right: var(--border)
  icon-size: 18px

Top bar:
  height: 48px
  background: var(--background)
  border-bottom: var(--border)

Tool panel:
  width: ~400px (collapsible to 0)
  background: var(--surface)
  border-right: var(--border)

Main content:
  background: var(--background)
  fills remaining space
```

---

## 7. References

- **Freepik Pikaso:** freepik.com/pikaso — collapsible sidebar, unified generator
- **OpenArt:** openart.ai — three-column layout, tool list sidebar, scalable
- **Midjourney:** midjourney.com — grid-focused, minimal chrome
- **Leonardo AI:** leonardo.ai — sidebar + tool panel pattern
- **Runway:** runwayml.com — similar multi-tool creative platform

---

*This document is for exploration and discussion. No code changes until direction is confirmed.*
