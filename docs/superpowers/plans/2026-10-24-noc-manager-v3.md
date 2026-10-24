# NOC Manager v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship NOC Manager 3.0 with company-aware CIDs, Data Center work, simplified settings CRUD, evaluation placement bootstrap, and logo theme control.

**Architecture:** Extend Service with a canonical company and add a non-mutating DataCenter service-work operation. Keep employee placement separate from service ownership and derive initial assignments from department through one tested policy function.

**Tech Stack:** Next.js, React, Prisma/PostgreSQL, Node test runner, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-24-noc-manager-v3.md`

## Global Constraints

- Customer records remain global.
- One Data Center ticket links exactly one existing CID.
- NocDatacenter maps to SDC; all other eligible departments map to ION.
- PRODC normalizes to SDC.
- Historical assignments and ticket snapshots are not rewritten.

## Review Focus

- A legacy PRODC value must read and write as SDC.
- Data Center resolve must not change product, capacity, or service status.
- Assignment synchronization must be idempotent and must report overlaps.
- Users without permission cannot manage evaluation or service work masters.
- The logo control must remain keyboard accessible and announce its action.

---

### Task 1: Canonical company policy and service ownership

**Files:** Modify `prisma/schema.prisma`; create `prisma/changes/20261024_noc_v3.sql`, `lib/companies/policy.js`, and tests; modify service APIs and asset UI.

**Interfaces:** Produces `normalizeCompany(value)` and `companyForDepartment(name)`.

- [ ] Write failing company-policy and service API/UI tests.
- [ ] Add backward-compatible Service company storage and validation.
- [ ] Show/edit company in customer-service inventory and service detail.
- [ ] Run focused tests and commit.

### Task 2: One-CID Data Center work

**Files:** Modify `lib/tickets/serviceWork.js`, `components/ServiceWorkFields.js`, service-work master API/UI, and tests.

**Interfaces:** Adds operation `DataCenter` whose snapshot stores structured details without inventory mutation.

- [ ] Write failing validation, resolve, and UI tests.
- [ ] Implement the operation and CID-derived summary.
- [ ] Add initial Data Center master seed script.
- [ ] Run focused tests and commit.

### Task 3: List-first settings and grouped navigation

**Files:** Modify `lib/navigation/model.js`, master clients/styles, workflow/evaluation clients, and navigation/UI tests.

- [ ] Write failing navigation and list-first rendering tests.
- [ ] Group settings labels and hide create forms until explicit action.
- [ ] Run focused tests and commit.

### Task 4: Evaluation placement bootstrap

**Files:** Create `lib/reports/assignmentBootstrap.js` and tests; modify evaluation API/client.

**Interfaces:** Produces an idempotent preview/apply operation using department-derived company.

- [ ] Write failing policy/idempotency/conflict tests.
- [ ] Add preview/apply endpoint behavior and concise UI.
- [ ] Improve missing-prerequisite explanations.
- [ ] Run focused tests and commit.

### Task 5: v3 brand control and release

**Files:** Modify `components/Navbar.js`, navigation CSS, `package.json`, lockfile, tests and release evidence.

- [ ] Write failing theme-control/version tests.
- [ ] Replace text switch with the ION logo and bump to `3.0.0`.
- [ ] Run the complete relevant suite and production build.
- [ ] Review, commit, push, deploy with immutable image and rollback script.
- [ ] Verify deployed HEAD, database migration, container health, local HTTP and domain HTTP.
