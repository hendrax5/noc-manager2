# Design System: ION NOC Manager

## 1. Visual Theme & Atmosphere
A **cockpit-dense operations console** for NOC and CS desks — calm under pressure, never decorative. Density sits at **7** (packed queues, timers, and status signals with tight rhythm). Variance at **5** (offset headers, asymmetric ticket detail splits — not gallery chaos). Motion at **4** (fluid CSS transitions only; no cinematic loops that distract an on-call engineer).

The atmosphere is **instrument panel meets control room**: zinc neutrals, one signal accent, monospace for timers and IDs, and surfaces that separate workstreams with hairline dividers rather than soft marketing cards. Light mode is the default duty surface; dark mode is a night-shift companion with the same hierarchy, never a neon VS Code clone.

## 2. Color Palette & Roles
- **Canvas Mist** (#F4F6F8) — Primary page background
- **Pure Surface** (#FFFFFF) — Panels, tables, elevated work surfaces
- **Charcoal Ink** (#18181B) — Primary text, headings, navbar shell (Zinc-950 depth; never pure `#000000`)
- **Muted Steel** (#71717A) — Secondary text, metadata, timestamps, helper copy
- **Whisper Border** (rgba(228, 228, 231, 0.9) / `#E4E4E7`) — 1px structural lines, table rules
- **Hover Veil** (#F4F4F5) — Row hover, subtle fills
- **Signal Teal** (#0F766E) — Single accent: primary CTAs, focus rings, active nav underline, Take It / resolve actions (saturation held under 80%)
- **Breach Coral** (#DC2626) — SLA breach / critical row signal only (semantic, not a second brand accent)
- **Watch Amber** (#D97706) — Warning / near-deadline rows
- **Clear Emerald** (#059669) — Resolved / healthy KPI tint

### Dark mode (same roles, night-shift values)
- **Night Canvas** (#121417) — Background
- **Night Surface** (#1C1F24) — Cards / tables
- **Night Ink** (#E4E4E7) — Primary text
- **Night Steel** (#A1A1AA) — Secondary text
- **Night Border** (#3F3F46) — Structural lines
- **Signal Teal** (#14B8A6) — Accent (slightly lifted for contrast on dark)
- Navbar: Charcoal Ink (#18181B) in both themes for brand continuity

## 3. Typography Rules
- **Display / UI sans:** Outfit — Track-tight (`letter-spacing: -0.02em` on page titles), weight-driven hierarchy (500 / 600 / 700). Page titles ~`1.75rem`–`2rem`, not screaming billboard sizes.
- **Body:** Outfit — Relaxed leading (`1.55`), readable at `0.95rem`–`1rem`. Soft max width `65ch` only for long prose (KB articles, ticket descriptions).
- **Mono:** JetBrains Mono — Tracking IDs (`HSK-…`), SLA countdowns, breach counts, KPI numbers, shift codes. Mandatory for all dense numeric columns.
- **Banned:** Inter, Roboto, Arial as brand fonts. Serif fonts banned in this dashboard UI. No generic system-only stack for headings.

## 4. Component Stylings
* **Buttons:** Flat Signal Teal fill for primary. Ghost / outline with Whisper Border for secondary. Tactile press: `transform: translateY(1px)` + slight scale `0.98` on `:active`. No outer glow. Hover darkens teal to `#0D9488` / `#115E59`. Min height `44px` on touch-critical actions.
* **Cards / panels:** Prefer `border + surface` over heavy shadow. Soft diffusion shadow only when elevation matters (`0 12px 32px -16px rgba(24, 24, 27, 0.12)`). Corner radius `0.75rem` on containers; tighter `0.5rem` on inputs and inner chips. On Live Ops / ticket lists (density 7+), prefer `divide-y` / border-top rows over boxed KPI cards where possible.
* **Inputs:** Label above, optional helper, error below. Focus ring: `0 0 0 3px rgba(15, 118, 110, 0.18)` with Signal Teal border. No floating labels.
* **Badges / status chips:** Squircle or soft rectangle (`border-radius: 0.375rem`), not candy pills for every label. Color encodes status; monospace optional for priority codes.
* **Loaders:** Skeleton shimmer blocks matching table rows / KPI strips. No generic circular spinners as the primary loading pattern.
* **Empty states:** Composed panel with one clear next action (e.g. “Create ticket” / “Claim unassigned”) — not bare “No data”.
* **Error states:** Inline, left-aligned under the field or banner above the form. Direct copy: “Connection failed. Try again.” — no “Oops!”.
* **Navbar:** Charcoal shell, Outfit medium links, active state via teal underline or weight shift — not emoji decoration.
* **Tables:** Hairline borders, tabular / mono numbers, left accent bar only for SLA risk rows (coral / amber).

## 5. Layout Principles
- Top command bar (existing pattern) — keep; do not force a marketing sidebar.
- Content max-width **1400px** centered for ops pages; ticket detail may use full useful width with asymmetric `2fr 1fr` (thread | properties).
- Page headers left-aligned with title + one primary CTA on the right — no centered hero layouts inside the app.
- Mobile `< 768px`: all multi-column grids collapse to single column; nav becomes vertical stack; tables scroll horizontally only as last resort.
- Vertical rhythm: section gaps `clamp(1.25rem, 3vw, 2rem)`. Optical padding: slightly more bottom than top on cards.
- No overlapping absolute content stacks. No three equal marketing feature cards.

## 6. Motion & Interaction
- Default transition: `180ms–280ms` with `cubic-bezier(0.16, 1, 0.3, 1)`.
- Spring-feel reserved for optional Framer later; **this codebase stays CSS-first** — no mandatory perpetual loops on Live Ops (motion would fight urgency).
- Status dots may use a restrained 2s opacity pulse for “live” / SLA watching only.
- Stagger list mount with `animation-delay` cascades on dashboard widgets (max ~6 items) — keep subtle.
- Animate **only** `transform` and `opacity`. Never animate `top`, `left`, `width`, `height`.
- Hover on rows: background Hover Veil. Buttons: background shift + tactile active press.

## 7. Anti-Patterns (Banned)
- No emojis in navigation, buttons, empty states, or labels
- No Inter font
- No pure black `#000000`
- No purple / neon blue glows, indigo marketing gradients, or dual-accent rainbow KPIs
- No oversaturated accents; Signal Teal is the only brand accent
- No 3-column equal “feature card” marketing layouts inside ops screens
- No AI copy (“Elevate”, “Seamless”, “Unleash”, “Next-Gen”)
- No generic placeholder names (John Doe, Acme, Nexus)
- No fake round metrics (`99.99%`, `50%`) — use real operational figures
- No “Scroll to explore” / bouncing chevrons
- No custom mouse cursors
- No overlapping text-on-image heroes (this is an internal ops app, not a landing page)
- No sun/moon emoji theme toggle — use text (“Light” / “Dark”) or a simple icon glyph via CSS/SVG
- Dark mode must not become a bright `#007acc` VS Code skin; keep Signal Teal continuity
