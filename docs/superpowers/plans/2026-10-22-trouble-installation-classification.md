# Trouble and Installation Classification Implementation Plan

> Execute with superpowers:subagent-driven-development. Reuse the current checkout on a dedicated codex branch. Preserve unrelated working changes and existing ticket workflows.

**Goal:** Keep Dashboard, Semua Tiket, and the existing installation form while adding work classification, dedicated filtered menus, editable trouble masters, and customer service CID linkage.

**Architecture:** One Ticket table and trackingId generator remain authoritative. Add a separate workType (Unclassified/Trouble/Installation), optional SAP reference, standard symptom/cause references with historical label snapshots, and an additive master-data table. Existing Service relations link tickets to customers; a canonical optional CID field supports legacy customData CID values. Existing ticketType, category scoring, routing, ACL and legacy forms remain intact.

**Tech stack:** Next.js, React, Prisma/PostgreSQL, Node test runner, browser fixture tests.

## Tasks

- [ ] Add schema, additive migration/default master seeds, pure classification/CID helpers and regression tests. Existing rows default Unclassified, no automatic legacy reclassification. No destructive SQL.
- [ ] Integrate create/update validation, required active symptom/cause for classified trouble, CID service selection, manual SAP for installation. Preserve old requests without workType and leave old category/points behavior unchanged.
- [ ] Extend the existing full ticket form and detail editor; preserve all existing fields/options. Show only relevant supplemental classification controls and clear irrelevant metadata on explicit type changes.
- [ ] Keep Semua Tiket and add Trouble/Instalasi menu links using the same visibility-guarded query. Add workType filter to dashboard and list without double-counting. Global default remains unchanged.
- [ ] Add Master Data Trouble page, duplicate-safe CRUD without deletion, active/inactive status, and manage_trouble_master permission. Read active choices as an authenticated operator; only authorized managers can mutate.
- [ ] Expose service CID in inventory and ticket selectors/search; preserve legacy CID customData fallback. Trouble supports multiple affected services, one row/ticket.
- [ ] Ensure outage reports exclude explicitly classified installations and use structured cause snapshots and CID. Preserve report behavior for legacy unclassified outage records.
- [ ] Run focused unit/API/UI checks, Prisma validation/generation, lint/build where available, and a fresh independent review. Document migration and remaining deployment requirements. Do not deploy or alter production DB during this implementation request.

## Contracts

- Work types: Unclassified, Trouble, Installation. Existing ITIL ticketType is not repurposed.
- TroubleMasterEntry kinds: symptom, cause. Unique kind+normalizedName, no hard delete. Existing snapshot labels remain if masters are renamed or disabled.
- Ticket fields: workType, sapReference, symptomId, causeId, symptomLabel, causeLabel.
- Master API: GET /api/trouble-masters?kind=symptom|cause (active only by default; includeInactive=true only permitted managers); POST /api/trouble-masters; PATCH /api/trouble-masters/[id].
- Master permission: Admin or manage_trouble_master. UI must permit users with this permission without requiring manage_settings.
- Master records: id, kind, name, normalizedName, description, active, sortOrder, createdAt, updatedAt.
- CID: Service.cid is optional for compatibility. getServiceCid(service) reads canonical cid then legacy CID/SID/Circuit ID customData. New classified Trouble requires >=1 service with a CID. Installation retains manual customer/legacy full form support.
- Scope links: /tickets?workType=Trouble, /tickets?workType=Installation; /tickets remains all permitted tickets. New form uses ?workType=... preset, not a replacement form.

## Rulings

- SAP manual reference remains optional until supplied, since mandatory entry was not requested.
- Legacy tickets remain Unclassified until deliberately edited; reporting keeps legacy downtime compatibility.
- No silent inference of workType from subject, SAP shape or category name.
- CID belongs to a service/link, not the customer record.
