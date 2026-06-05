# Neo-Brutalism UI Skill

When asked to build or refine UI with this skill, implement **neo-brutalism** — a design aesthetic defined by:
- Visible structure (thick borders, no hiding the grid)
- Physical tactility (offset shadows that make elements feel pressable)
- High contrast (stark ink/paper with vivid intent-color accents)
- Two-layer typography (geometric sans for reading, monospace for labels/metadata)
- Honest interaction (hover = element lifts via translate + shadow increase)

No soft drop shadows. No glass morphism. No gradients on surfaces.

---

## Design Tokens

Define as CSS custom properties — use them everywhere, never hardcode.

```css
:root {
  /* surfaces */
  --paper:    #f3ead4;   /* page background */
  --card:     #fffdf6;   /* panel / card background */
  --ink:      #181410;   /* primary text — warm near-black */
  --ink-soft: #5b5347;   /* secondary text — warm brown */
  --line:     #181410;   /* border color */

  /* intent palette */
  --learn: #ffd23f;   /* sunny yellow  — knowledge to revisit */
  --act:   #ff5c39;   /* tomato coral  — tasks / urgency */
  --ref:   #3a86ff;   /* sky blue      — reference / lookup */
  --eph:   #b9a7ff;   /* lavender      — ephemeral / low-signal */
  --done:  #2ec27e;   /* moss green    — completion */

  /* border weight */
  --bw: 3px;

  /* tiered shadow system — always offset, never soft */
  --shadow-sm: 3px 3px 0 var(--line);
  --shadow:    5px 5px 0 var(--line);
  --shadow-lg: 8px 8px 0 var(--line);
}
```

**Critical**: `--act` is coral/urgent, NOT green. Green is for `--done`. This is intentional — act items demand attention, done items signal calm completion.

---

## Typography — Two-Font System

Neo-brutalism is NOT monospace-only. Separate the reading layer from the label layer:

- **Body / summaries / headings**: `Space Grotesk` (geometric sans, warm, readable)
  - Font sizes: 16–19px for summaries, 22px for section headers
  - Weight: 500–700
- **Labels, badges, metadata, buttons, tabs**: `JetBrains Mono` (or Space Mono)
  - Font size: 10–12px, `font-bold`, `uppercase`, `tracking-[0.08–0.18em]`

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
```

```css
body { font-family: "Space Grotesk", system-ui, sans-serif; }
.mono { font-family: "JetBrains Mono", monospace; }
```

**Never** use Inter, Roboto, or system-ui for the body — they're generic. Never use monospace for body text — it harms readability at scale.

---

## Background — Dot Grid

```css
body {
  background-color: var(--paper);
  background-image: radial-gradient(var(--line) 0.9px, transparent 0.9px);
  background-size: 26px 26px;
  background-position: -13px -13px;
}
```

Dot grids are cleaner than diamond/hex grids for personal tools. The offset `background-position` ensures no dot sits at the exact corner.

---

## Shadows — The Signature Move

The offset shadow makes elements feel physical. **Always** pair with a translate on hover.

```css
/* Tiered: use the right level for context */
--shadow-sm: 3px 3px 0 var(--line);  /* cards, secondary buttons */
--shadow:    5px 5px 0 var(--line);  /* focal panels, primary CTA */
--shadow-lg: 8px 8px 0 var(--line);  /* modal-level elements */

/* Interaction pattern */
default:  box-shadow: var(--shadow-sm)
hover:    box-shadow: var(--shadow);  transform: translate(-2px, -2px)
active:   box-shadow: 0;             transform: translate(3px, 3px)
```

Badges also get shadows — `box-shadow: 2px 2px 0 var(--line)`. Even small elements should feel pressable.

---

## Component Patterns

### Card — with Intent Color Spine

The colored left spine is the most impactful neobrutalist card pattern — communicates intent at a glance.

```tsx
<div
  className="relative border-2 border-[var(--line)] overflow-hidden"
  style={{ background: 'var(--card)', boxShadow: 'var(--shadow-sm)' }}
  onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translate(-2px,-2px)' }}
  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = '' }}
>
  <div className="flex">
    {/* Intent color spine — 12px wide, left edge */}
    <div className="w-3 flex-shrink-0 border-r-2 border-[var(--line)]" style={{ background: intentBg }} />
    <div className="flex-1 min-w-0 px-5 py-4">
      {/* content */}
    </div>
  </div>
</div>
```

### Badge

Badges carry their own 2px shadow — they feel like stickers.

```tsx
<span
  className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 leading-none border-2 border-[var(--line)] inline-flex items-center whitespace-nowrap"
  style={{ background: intentBg, boxShadow: '2px 2px 0 var(--line)' }}
>
  LEARN
</span>
```

### Tag / Pill

Tags use `border-radius: 999px` — a concession to warmth. Structural elements (cards, buttons, panels) stay sharp. Tags are categorization, not action.

```tsx
<span
  className="font-mono text-[10px] border border-[var(--line)] px-2 py-px rounded-full"
  style={{ color: 'var(--ink-soft)', background: 'var(--paper)' }}
>
  tag-name
</span>
```

### Tab Bar

Equal-width tabs (`flex: 1`). Active = ink/paper inversion. Use `border-right` on all but last.

```tsx
<div className="flex border-b-2 border-[var(--line)]">
  {TABS.map(t => (
    <button
      key={t.id}
      className="font-mono flex-1 py-3 border-r-2 border-[var(--line)] last:border-r-0 text-[12px] font-bold tracking-[0.12em]"
      style={{
        background: active ? 'var(--ink)' : 'var(--card)',
        color: active ? 'var(--paper)' : 'var(--ink)',
      }}
    >
      {t.label}
    </button>
  ))}
</div>
```

### Button — Primary CTA

Use intent colors (`--learn` yellow) for the main action, not generic black/white.

```tsx
<button
  className="font-bold text-[14px] uppercase tracking-[0.04em] px-5 py-2.5 border-2 border-[var(--line)] transition-all duration-100 hover:-translate-x-px hover:-translate-y-px active:translate-x-0"
  style={{ background: 'var(--learn)', color: 'var(--ink)', boxShadow: 'var(--shadow-sm)' }}
  onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow)')}
  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
>
  Capture ↵
</button>
```

### Focal Panel (always-on shadow)

```tsx
<section
  className="border-2 border-[var(--line)] overflow-hidden"
  style={{ background: 'var(--card)', boxShadow: 'var(--shadow)' }}
>
  {/* content */}
</section>
```

### Scrollbar

Brutalist scrollbars — thick, visible, with border.

```css
::-webkit-scrollbar { width: 12px; }
::-webkit-scrollbar-track { background: var(--paper); border-left: 3px solid var(--line); }
::-webkit-scrollbar-thumb { background: var(--ink); border: 3px solid var(--paper); }
```

### Selection

```css
::selection { background: var(--learn); color: var(--ink); }
```

### Delight — DONE Stamp Animation

For actions with satisfying completion (marking done, submitting):

```css
@keyframes stamp {
  0%   { opacity: 0; transform: rotate(-14deg) scale(2.2); }
  60%  { opacity: 1; transform: rotate(-14deg) scale(.92); }
  100% { transform: rotate(-14deg) scale(1); }
}
```

```tsx
{stamping && (
  <div className="absolute inset-0 grid place-items-center pointer-events-none" style={{ background: 'rgba(255,253,246,.7)' }}>
    <div
      className="font-bold text-[64px] px-6 border-[6px] leading-none"
      style={{ color: 'var(--done)', borderColor: 'var(--done)', animation: 'stamp .5s cubic-bezier(.2,1.4,.4,1) both' }}
    >
      DONE
    </div>
  </div>
)}
```

---

## Layout Rules

- Two-panel layout: `grid-template-columns: minmax(380px, 460px) 1fr`
- Panel padding: `22px` (not `24px`/`p-6` — use exact values for precision)
- Between sections within a panel: `gap: 22px`
- Between cards in a feed: `gap: 12px` (tighter than you'd expect — cards already have borders)
- Section headers (`h2`): `font-size: 22px, font-weight: 700, letter-spacing: -0.01em`
- Always use `border-r` on left panel, `overflow-y: auto` on both panels, `height: calc(100vh - headerHeight)` for both

---

## Header Pattern

```tsx
<header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '20px 26px', borderBottom: 'var(--bw) solid var(--line)', background: 'var(--paper)' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    <SporeIcon size={42} />  {/* branded SVG icon */}
    <div>
      <div style={{ fontWeight: 700, fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1 }}>APP NAME</div>
      <div className="mono eyebrow" style={{ marginTop: 5 }}>Subtitle</div>
    </div>
  </div>
  <div style={{ display: 'flex', gap: 12 }}>
    <span className="badge">12 CAPTURES</span>
    <span className="badge" style={{ background: 'var(--done)' }}>● LOCAL</span>
  </div>
</header>
```

---

## Anti-Patterns — Never Do These

| ❌ Avoid | ✅ Use instead |
|---|---|
| `shadow-lg` (soft drop shadow) | `var(--shadow)` (offset, hard) |
| `rounded-lg` on cards/buttons | `rounded-none` — keep edges sharp |
| Gradient backgrounds | Flat `var(--paper)` + dot grid |
| `border` (1px) on interactive elements | `border-2` minimum |
| Generic grey for secondary text | `var(--ink-soft)` — warm brown |
| All monospace everywhere | Two-font system: sans for body, mono for labels |
| `act` intent = green | `act` = coral/red (#ff5c39). Green = `done` |
| Tiny section headers | `h2` at 22px bold for major sections |
| Square pill tags | Tags use `border-radius: 999px` for warmth |
| Badges without shadows | Every badge: `box-shadow: 2px 2px 0 var(--line)` |
| `Inter`, `Roboto` | `Space Grotesk` for body |
| Invisible scrollbars | Thick, ink-colored brutalist scrollbars |

---

## Reference Implementations

- **Mycelium** (this project) — personal knowledge agent, light neobrutalism
- **RetroUI** (retroui.dev) — component library, warm cream palette
- **marieooq/neo-brutalism-ui-library** — component patterns
- **Unstructured.io** — enterprise neobrutalism, light theme
