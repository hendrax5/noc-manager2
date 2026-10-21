# CID Service Work Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a new EWO ticket from a circuit, classify service work, and atomically apply its requested Inventory changes on Resolve.
**Architecture:** Preserve Ticket, Service, scoring, existing forms and legacy classification. Add ServiceWorkType master and a structured serviceChange JSON snapshot on Ticket. ServiceWork tickets use exactly one Service; Trouble keeps multiple Services. Resolve checks the snapshot and writes Inventory, audit, ticket and scores in one transaction with concurrency protection.
**Tech Stack:** Existing Next.js/React, Prisma/PostgreSQL, node:test, esbuild fixture API/browser checks.
**Spec:** docs/service-work/BRIEF.md

## Global Constraints
- Same application, Dashboard and Semua Tiket remain global; no reclassification/deletion of legacy data.
- New EWO for each new job; immutable CID identity; existing generator and scoring values retained.
- Existing legacy Installation continues to work; new workType ServiceWork uses master operation.
- Products use ServiceTemplate; one CID per service change. No billing/IP/VLAN/device automation.
- New migration is additive and idempotent. No production deployment in this implementation request.

## Review Focus
- Repeated/concurrent Resolve must not apply Inventory or award points twice.
- Concurrent Inventory change produces conflict rather than silent overwrite.
- Future effective dates, inactive/deleted masters and changed template requirements are validated.
- Status-only actors cannot forge serviceChange snapshots or alter application markers.
- Reopen, legacy tickets, multiple Trouble CID links, scoring and report exclusions remain compatible.

## Shared interfaces
- ServiceWorkType: id, name, normalizedName unique, operation (Installation/Upgrade/Downgrade/Change/Terminate), defaultJobCategoryId nullable, active, sortOrder, createdAt/updatedAt. No delete; operation immutable after creation.
- Ticket: serviceWorkTypeId nullable (no relation required), serviceWorkTypeLabel nullable, serviceChange Json nullable.
- workType adds ServiceWork; legacy Installation preserved. Work type helper labels ServiceWork Pekerjaan Layanan.
- POST/PATCH inputs: serviceWorkTypeId; serviceIds=[id]; serviceChange={targetTemplateId?, bandwidthMbps?, effectiveDate:YYYY-MM-DD, reason?, targetCustomData?}. Backend owns before/appliedAt and all snapshots; no client snapshot trust. Backend returns stored serviceChange with before, after, effectiveDate, reason, operation, appliedAt nullable.
- Before/after shape: {serviceId,cid,templateId,templateName,status,bandwidthMbps,customData,updatedAt}; after customData is merged, not destructively replaced. Capacity canonical Service.customData.bandwidthMbps; legacy aliases are read explicitly where unambiguous, unknown must be filled/reviewed. Stable units Mbps.
- GET /api/service-work-types active authenticated; includeInactive manager only. POST and PATCH /api/service-work-types/[id] admin or manage_service_work permission, fresh DB authorization. Master UI /settings/service-work-types.
- GET /tickets/new?serviceId=N&workType=ServiceWork preselects server-validated CID/service; form loads active types. Creation page supplies serviceTemplates and services.

### Task 1: Domain, schema, APIs, atomic Resolve (backend worker)
**Files:** prisma/schema.prisma; prisma/changes/20261022_service_work.sql; lib/tickets/serviceWork.js; lib/tickets/serviceWork.test.mjs; lib/tickets/workClassification.js; app/api/service-work-types/**; app/api/tickets/route.js; app/api/tickets/[id]/route.js; report classification helpers.
- [ ] Write failing tests for snapshot ownership, one CID, numeric capacity, dates, operation direction, master validity, conflict, repeat application and atomic failure; run to confirm red.
- [ ] Implement shared interfaces and additive schema; validate SQL and Prisma.
- [ ] Route ticket create/update through service-work validation; immutable applied payload. Resolve under DB transaction/lock, fresh ticket state, shared application + score audit commit.
- [ ] Update report filters to exclude ServiceWork alongside legacy Installation; run existing classification/report regressions and new tests.

### Task 2: Ticket input, CID entry and navigation (form worker)
**Files:** components/TicketWorkClassification.js; new components/ServiceWorkFields.js; app/tickets/new/{page.js,TicketForm.js}; components/Navbar.js; app/tickets/page.js; app/dashboard/**; app/assets/[id]/ServiceDetailClient.js.
- [ ] Build conditional inputs following shared contract: searchable existing CID, master work type, current/target product + numeric capacity + date/reason + template-required fields; preserve old custom inputs and general handling fields.
- [ ] Prefill service from URL, suggest Job Category without overwriting manual choice, suggest editable subject; add Buat Tiket on service page and filter history/navigation.
- [ ] Exercise actual form fixtures for Upgrade/Change/Terminate, CID prefill, required fields, legacy paths and 320px layout.

### Task 3: Master management (master UI worker)
**Files:** app/settings/service-work-types/{page.js,ServiceWorkTypesClient.js}; permissions registry(s), Team Access Manager permission list; scripts/test_service_work_master_ui.cjs.
- [ ] Reuse app styles and management patterns; implement add/edit/disable/search and default Job Category mapping; operation immutable on edit.
- [ ] Add manage_service_work permission without running permission seed or modifying existing roles.
- [ ] Verify ACL, duplicate names, active choices and responsive master screen.

### Task 4: Integration and ticket details (root)
**Files:** app/tickets/[id] detail components; docs/service-work/BRIEF.md; docs/SERVICE_WORK.md; scripts/test_service_work_api.cjs; plan ledger.
- [ ] Render server snapshots before/after, product, capacity, effective date and application state on detail; surface Resolve conflicts and confirmation summary.
- [ ] Integration tests prove actual API atomicity, idempotency, permissions, scoring retention and safe Inventory updates; run complete relevant tests + ESLint + Prisma validate/generate + production build where environment permits.
- [ ] Review each task for spec and quality, fix findings; independent final review and actual UI render before completion claim.

## Execution record
Track progress and rulings in 2026-10-22-cid-service-work-ledger.md; do not rewrite this plan during execution.
