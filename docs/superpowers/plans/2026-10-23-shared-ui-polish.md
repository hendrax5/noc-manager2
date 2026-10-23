# Shared UI polish implementation plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation and a fresh final review.

**Goal:** Make all existing NOC Manager pages use the approved mockup's restrained typography, surfaces, form controls, tables and spacing; unify Kapasitas with automatic pair/Gbps.

**Architecture:** Shared semantic tokens imported once at root. Existing global component CSS and CSS Modules consume them. Extract static visual declarations from legacy inline styles into generated scoped classes, retaining dynamic styles, DOM, routing and business behavior. Do not introduce another application or replace existing navigation.

**Tech Stack:** Next.js App Router, React, CSS variables/Modules, Babel AST for a one-time reversible static-style migration, Playwright/axe and isolated PostgreSQL QA.

## Audit findings

| Priority | Finding | Change |
|---|---|---|
| Major | Controls outside .form-group inherit browser fonts; defaults look unlike mockup | Shared form-control foundation |
| Major | Inline decoration overrides theme and differs on every page | Extract static visual declarations and normalize to semantic tokens |
| Major | Excessive card shadows/padding and inconsistent headings | Flat surfaces, compact 14px system typography and spacing scale |
| Major | Ticket fieldsets visually nested and unstyled legends | Form sections, clear labels/help, consistent controls |
| Major | Different capacity labels across products | Kapasitas field, unit shown automatically, retain pair/BW validation |
| Major | Wide dashboards/tables need containment on phones | Responsive page shell, contained table scrolling, stacked form layouts |

## Tasks

- [ ] 1. Inventory all 33 page entrypoints and preserve baseline screenshots on isolated QA.
- [ ] 2. Introduce shared semantic UI tokens and component foundation; remove font split, reduce decorative shadows, preserve dark/print.
- [ ] 3. Migrate static legacy presentation into scoped CSS across pages/components; retain dynamic status/layout expressions. Keep native selectors for this CSS-only task to preserve behavior, keyboard interaction and existing tests.
- [ ] 4. Refine ticket, customer/assets, reports and settings CSS Modules; unify Kapasitas unit labels.
- [ ] 5. Run library and existing UI regressions; render every accessible route at desktop/mobile in light/dark, inspect representative screenshots and measure issues. Fix observed regressions.
- [ ] 6. Fresh final review, production build, backup and deploy with immutable previous image rollback. No schema/data migration required. Verify runtime and domain, document actual coverage and limits.

Validation must distinguish existing page issues from new ones; do not claim a full accessibility certification from spot checks or waived gates. No changes to SLA calculation, scoring, routing identities, authorization, or persisted inventory values.
