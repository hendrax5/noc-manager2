# SAP CID Assets and Trouble Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect complete SAP circuit IDs from ticket subjects, show them in Assets without guessing customer ownership, and put CID selection before Trouble symptoms.
**Architecture:** Read-only grouping derives candidates from existing tickets; no duplicate placeholder Customer or product records. Inventory managers explicitly map unmapped circuits to an existing Customer/product once. Mapping creates one Service and joins its source tickets atomically without resetting historical status, timestamps, classification or scores. Future SAP tickets auto-link to an existing unique Service.
**Tech Stack:** Existing Next.js/React, Prisma/PostgreSQL, node:test, esbuild/Playwright fixtures.
**Spec:** docs/sap-cid/BRIEF.md and user's screenshot/correction: SAP numeric segments do not identify the customer.

## Global Constraints
- Only complete SAP CID tokens, normalized for case/whitespace; never infer owner from numeric segments.
- No automatic customer/product creation from reporter prose. Missing mapping is visible in Assets as needs completion.
- One customer may own multiple unrelated CIDs; one CID may have multiple historical tickets.
- Never alter job scores, ticket statuses, downtime, historical classifications, or Inventory parameters while linking.
- Canonical and legacy CID aliases checked; duplicates and incompatible existing links are conflicts, not overwritten.
- No schema change needed; new APIs use fresh database role check (Admin/manage_assets). Reads never mutate.

## Review Focus
- Duplicate CID imports and concurrent mapping must create one Service.
- Mismatched source ticket links, duplicate legacy CIDs, malformed SAP titles require review.
- Mapping missing customer/product must not silently create fake customers.
- Linking source tickets must not change Service updatedAt and break pending ServiceWork snapshots.
- CID typed into symptom search should explain the mistake and offer clear reset.

### Task 1: Candidate domain and mapping
Files: lib/services/sapCid.js, sapCid.test.mjs; lib/services/sapAssets.js; app/api/assets/sap-circuits/route.js.
- [ ] Write and run failing tests for strict SAP extraction, grouping, names as prose, no numeric ownership, existing/legacy CID conflicts and pagination.
- [ ] Implement helpers, fresh ACL GET preview/POST mapping, advisory CID lock + source row revalidation, raw join insertion preserving timestamps, audit logs without scoring.
- [ ] Test actual API with transactional fixtures including unauthorized, duplicate/replay, conflicts and mapping requirements.

### Task 2: Assets discovery and future ingestion
Files: app/assets/SapCircuitsClient.js; app/assets/AssetClient.js; app/api/tickets/route.js; lib/integration/tickets.js.
- [ ] Add CID SAP panel in Assets for Inventory managers with search, pagination, source names, review conflicts, explicit Customer/product/status mapping and link to created Service.
- [ ] Link new complete SAP subjects to a uniquely matching canonical/legacy Service; preserve manual links and never create Services from incomplete data.
- [ ] Test new ingestion and mapping idempotency; failures do not lose already-created tickets.

### Task 3: Trouble UX and regression
Files: components/TicketWorkClassification.js; app/tickets/new/TicketForm.js; app/tickets/[id]/TicketDetailClient.js; scripts/test_sap_assets_ui.cjs; ticket UI tests.
- [ ] Show searchable multi-CID picker first, then optional symptom filter and Gejala/Penyebab; remove duplicate customer selector in Trouble.
- [ ] Show no-match feedback/reset and explicit CID warning in symptom filter; retain active/inactive master behavior.
- [ ] Run unit/API/browser regressions, lint, Prisma validation, and record actual build/deploy outcomes separately.

## Execution
Progress and rulings go in 2026-10-22-sap-cid-assets-ledger.md. Preserve unrelated ignore edits and scripts/_fix and scripts/_oct_report.
