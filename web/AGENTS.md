# Tracely Web — Design System & Figma Sync Rules

These workspace rules govern UI updates across `c:\docstrack\web` and keep the Web UI aligned with `c:\docstrack\mobile`.

## 1. Linked Figma Design File
- **File Name:** `Tracely — Web UI & Design System`
- **File Key:** `Z2cJb4KjR9s9qOT7dpVBT3`
- **URL:** https://www.figma.com/design/Z2cJb4KjR9s9qOT7dpVBT3
- **Team Plan Key:** `team::1536332203336677583`

## 2. Design Tokens (`web/src/styles/tokens.css`, synced with `mobile/src/ui/theme/tokens.ts`)
Always use CSS custom properties from [tokens.css](./src/styles/tokens.css):
- **Primary Brand:** `--navy` (`#0D3472`), `--navy-mid` (`#164A9E`), `--navy-deep` (`#09234D`), `--navy-ink` (`#0D1B3E`)
- **Action / Accent:** `--amber` (`#F3B32A`), `--amber-hover` (`#E5A41C`), `--teal` (`#0F766E`), `--teal-dot` (`#0D9488`)
- **Semantic Pills:** `--sky-*`, `--amber-*`, `--emerald-*`, `--teal-*`, `--rose-*`, `--indigo-*`
- **Surfaces & Borders:** Pure white canvas `--bg` (`#FFFFFF`), card surfaces `--surface-soft` (`#F4F6FA`) & `--surface` (`#FFFFFF`), `--border` (`#E5E7EB`), `--border-strong` (`#CBD5E1`)
- **Text Hierarchy:** `--text-primary` (`#0F172A`), `--text-secondary` (`#475569`), `--text-muted` (`#64748B`)
- **Radii & Focus:** `--radius-input` (`12px`), `--radius-md` (`14px`), `--radius-card` (`20px`), `--radius-hero` (`24px`), `--radius-pill` (`999px`), `--shadow-modal`, `--focus-ring`

## 3. Mobile-Grounded Visual Hierarchy & Responsive Rules
- **Pure White Canvas + Soft Slate Cards:** Do not use SaaS dashboard gradient washes, colored left stripes on document cards, or generic drop-shadow bloat. Primary list items (`.doc-card`) sit cleanly on `--surface-soft` (`#F4F6FA`) over `--bg` (`#FFFFFF`).
- **Card Visual Hierarchy:** Muted monospace `.doc-tracking-code` (`12px`) -> bold document title (`.doc-title`, `15px/800`) -> concise route metadata (`.doc-meta`, `12px`) -> full-contrast Amber `.btn-amber` primary CTA + White Navy-bordered `.btn-outline` secondary CTA.
- **Navigation & Responsive Breakpoints:**
  - Desktop (`> 980px`): Sticky left `.web-sidebar` (`244px`) + crisp solid white `.web-topbar` + fluid 2-column grids (`.dashboard-grid`, `.send-workspace`, `.profile-grid`).
  - Tablet (`<= 980px`): Single-column grids + slide-over `.web-sidebar-open` with interactive `.sidebar-scrim` backdrop.
  - Mobile (`<= 680px`): Single-row compact header, circular `.filter-circle-btn`, single-line horizontally scrolling `.tab-scroll-row`, and fixed `.mobile-bottom-nav` (`Inbox`, `Scan`, `Send`, `Track`, `Alerts`; `Categories` remains in `.web-sidebar`).
- **Reduced Motion:** All animations and transitions honor `@media (prefers-reduced-motion: reduce)`.

## 4. Quality & Verification
- Keep `web/tsconfig.json` strict builds clean (`tsc -b`): do not place uncompiled `@figma/code-connect` imports inside `web/src/`.
- Preserve accessible labels and selectors tested by `web/__tests__/WebApp.test.tsx`.
- Verify all 4 commands after UI edits:
  - `npm --prefix web test`
  - `npm --prefix web run typecheck`
  - `npm --prefix web run lint`
  - `npm --prefix web run build`
