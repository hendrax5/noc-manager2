# Multi-format CID Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mendeteksi Subject CID lama dan SAP, menautkannya ke circuit customer secara aman, serta membuat kode lama tetap dapat dicari tanpa menggandakan Asset.

**Architecture:** Parser murni menghasilkan identifier terstruktur; kebijakan sumber terpisah menentukan apakah tiket layak ditautkan. Resolver identifier utama/alias dan transaksi penautan dipakai bersama oleh UI dan integrasi EWO. Kandidat ambigu tetap dalam antrean review.

**Tech Stack:** Next.js/React, Prisma 5, PostgreSQL, node:test, esbuild/Playwright fixtures.

**Spec:** `docs/superpowers/specs/2026-10-22-multi-format-cid-design.md`

## Global Constraints

- Rencana saja sampai implementasi diminta; tidak ada backfill otomatis saat deploy.
- Customer satu kali, tipe layanan pada Service/CID, satu circuit per pekerjaan perubahan, Trouble dapat memilih beberapa CID.
- Tidak menyimpulkan owner/produk dari prefix atau urutan angka; tidak mengganti kode I menjadi SAP.
- Tidak mengubah scoring, downtime, status/umur tiket, produk/bandwidth, ataupun riwayat secara diam-diam.
- Pertahankan URL/API SAP lama sebagai jalur kompatibilitas, Dashboard, Semua Tiket, dan form instalasi lama.
- Gunakan backup dan migrasi aditif; jangan `db push --accept-data-loss` atau drop data identifier untuk rollback aplikasi.

## Review Focus

1. Unclassified legacy dengan kategori Troubleshoot harus ditolak sebagai sumber CID baru.
2. Perbedaan nol di depan, prefix, dan tanda hubung tidak boleh disatukan otomatis.
3. Kode sama pada customer/site berbeda harus menjadi konflik walaupun belum ada relasi Service.
4. Dua worker/proses yang menautkan kode bersamaan tidak boleh membuat duplikat atau merebut alias.
5. Kode lama I dan SAP tidak boleh menghasilkan Service baru jika keduanya sudah dikonfirmasi alias satu circuit.

### Task 1: Parser format dan kebijakan sumber

**Files:** Create `lib/services/circuitIdentifier.js`, `lib/services/circuitIdentifier.test.mjs`, `lib/services/circuitSourcePolicy.js`, `lib/services/circuitSourcePolicy.test.mjs`; modify compatibility exports in `lib/services/sapCid.js` only when needed.

**Interfaces:** `parseCircuitIdentifier(subject) -> { code, family, formatStatus } | null`; `classifyCircuitSource(ticket) -> { eligibility: 'eligible'|'review'|'excluded', reason }`.

- [ ] Write failing tests for the audited SAP, I/C segment variants, secondary prefix families, lowercase/whitespace, zero preservation, malformed codes and prose titles. Secondary/irregular formats must be review candidates, not silently corrected.
- [ ] Write policy tests for explicit Trouble, legacy Troubleshoot, Monitoring/Daily Report, Unclassified Installasi, ambiguous General/Customer, and explicit ServiceWork. Never use ticketType Incident alone as Trouble evidence because legacy installations use that default.
- [ ] Run `node --test lib/services/circuitIdentifier.test.mjs lib/services/circuitSourcePolicy.test.mjs`, confirm failures, implement finite tested pattern families and source policy, then confirm pass. Cover review-focus 1/2.
- [ ] Commit this independently testable unit.

### Task 2: Main/alias identifier registry and common resolver

**Files:** Modify `prisma/schema.prisma`, `lib/services/cidLookup.js`, `app/api/assets/services/route.js`, `app/api/assets/services/[id]/route.js`; create `lib/services/circuitRegistry.js`, `lib/services/circuitRegistry.test.mjs`, `prisma/migrations/20261022_circuit_identifiers/migration.sql` after verifying the repository migration convention.

**Interfaces:** `resolveCircuitIdentifier(db, code) -> { status: 'matched'|'missing'|'conflict', serviceId? }`; `registerCircuitIdentifier(tx, { serviceId, code, sourceTicketId, actorId })`. Keep `getServiceCid` as canonical display, not an async lookup.

- [ ] Test canonical/legacy JSON CID/alias resolution, global case-normalized uniqueness, cross-service collision, same-service idempotency, and old I + SAP aliases resolving to one Service.
- [ ] Add `ServiceIdentifier` with unique normalized code, Service FK, original code/family, provenance ticket/actor and createdAt. Keep Service.cid. Define all canonical/alias write paths to register/check identifiers in the same transaction, with normalized-code locks and database uniqueness.
- [ ] Backfill existing canonical/legacy identifiers by dry-run first; reject contradictory aliases rather than overwriting. Audit the 20 existing confirmed mappings as fixtures/baseline, not a new mass update. Alias-only insertion must not change canonical CID or ServiceWork inventory snapshots.
- [ ] Verify migration + resolver against a disposable PostgreSQL database, including parallel writes and rollback of failed audit registration. Cover review-focus 4/5. Generate Prisma client; commit.

### Task 3: Generic discovery and idempotent linkage

**Files:** Create `lib/services/circuitAssets.js`, `lib/services/circuitAssets.test.mjs`, `app/api/assets/circuit-candidates/route.js`; modify `lib/services/sapAssets.js`, `app/api/assets/sap-circuits/route.js`, `app/api/tickets/route.js`, `lib/integration/tickets.js`; extend `scripts/test_sap_assets_api.cjs` or add `scripts/test_circuit_assets_api.cjs`.

**Interfaces:** `loadCircuitCandidates(db, filters)`, `mapCircuitCandidate(db, body, actorId)`, `linkKnownCircuit(db, ticketId)`; old SAP helpers/routes delegate with SAP-family filtering.

- [ ] Test candidate grouping by complete normalized code, source eligibility, raw/full source-name evidence, conflicting site/owner, manual link preservation, and legacy endpoint compatibility. Fix the existing reporter parser truncation at the first ` - `; preserve the full trailing reporter marker and explicit Customer Name evidence separately.
- [ ] Make discovery query all recognized code families, not `title contains SAP`. Compare all relevant source tickets, not only the first five displayed names. Different names produce review/conflict until identity is confirmed; cosmetic variation is not itself proof of a different owner.
- [ ] Link only an existing unique resolver match or explicitly confirmed existing Service. Unknown codes create candidates. Creation of a new Service requires explicit customer/product metadata through the existing Asset flow. Unknown/ambiguous families do not auto-create aliases or Services.
- [ ] Apply row/advisory locks in a documented stable order; audit linkage without score; keep raw relation joins so Ticket.updatedAt and canonical-unchanged Service.updatedAt are preserved. Web/EWO ingestion must retain a ticket if linkage fails and leave a retriable candidate.
- [ ] Run fixture API tests and real PostgreSQL concurrent/rollback tests, including full-code Trouble and the same code attached to two sites. Cover review-focus 1/3/4; commit.

### Task 4: Assets and ticket search/UI

**Files:** Modify `app/assets/AssetClient.js`, `app/assets/SapCircuitsClient.js`, `app/assets/CustomerServiceInventory.js`, `app/assets/[id]/ServiceDetailClient.js`, `components/TicketWorkClassification.js`, `lib/services/cidLookup.js`, and the Assets services API responses; extend `scripts/test_customer_assets_ui.cjs`, `scripts/test_sap_assets_ui.cjs`, `scripts/test_ticket_classification_ui.cjs`.

- [ ] Test the tab title **Penautan CID**, family filter, review/conflict reasons, source ticket/category, and main CID + old-code display. Keep `/assets#sap-circuits` working as a compatibility entry point; optionally introduce `#circuit-candidates`.
- [ ] Include identifier summaries in service search payloads. Canonical + alias searches must resolve to the same Service in Assets, ticket CID picker, and ticket-list CID filtering. Keep customer grouping and type/product on Service rows.
- [ ] Display candidate `I-0275-021-01 → GIGA DIGITAL / OFFICE KEPANJEN` with source ticket 11952 and explicit existing-Service selection. Do not auto-fill product or apply the email's 2 Gbps to Inventory.
- [ ] Run browser fixtures at desktop and 320px, with alias search, missing/empty states, source-policy feedback, and legacy SAP navigation. Inspect rendered results, then commit.

### Task 5: Audit and controlled backfill of existing data

**Files:** Create `scripts/audit_circuit_identifiers.cjs`, `scripts/backfill_circuit_identifiers.cjs`; create operation-specific manifests/reports outside public app directories.

- [ ] Export a READ ONLY audit: ticket/code/family, category/source eligibility, customer/site evidence, existing links, proposed Service, alternate identifiers, and conflicts. No `map` function execution in the audit script.
- [ ] Reassess the remaining Assets against all supported formats. Manually review customer+site evidence; do not auto-accept fuzzy matches or generic customer-only names. Keep known SAP-C-1968-0001 and SAP-C-0035-0007 conflicts unresolved until evidence is supplied.
- [ ] Produce an exact proposed change list and backup plan. Get approval for the concrete mass-change list; implementation approval alone is not an approval to migrate ambiguous production identities.
- [ ] Execute approved rows transactionally, save before/after and audit records; verify no Service/customer duplication, no score/downtime/status/age changes. Provide a state-checked targeted rollback that refuses to overwrite subsequent user edits.

### Task 6: Release and operational verification

**Files:** Deployment release/operation manifests on the existing server; no standalone website.

- [ ] Run parser/policy/registry/API/UI suites, lint and Linux production build. Verify migration in a scratch database before production.
- [ ] Create/verify production backup and previous image rollback. Apply additive migration; deploy the prebuilt app using the existing release-compose override, avoiding destructive startup schema pushes.
- [ ] Verify authenticated Assets, ticket creation, integrations and CID/alias search; validate domain HTTP, deployed revision, containers and unchanged baseline counts before any separately approved backfill.
- [ ] Disable automatic alias assignment/backfill on rollback, revert app image while keeping registry data, and document targeted reversal of any approved mapping operation. Report actual checks and any remaining review queue.
