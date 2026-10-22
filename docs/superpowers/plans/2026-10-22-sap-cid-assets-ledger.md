# SAP CID execution ledger

- User confirmed SAP prefix identifies circuit services; numeric segments are only work sequence, never customer identity.
- Ruling: show unmapped SAP circuits automatically in Assets review list, not as fabricated Services under guessed owners/products. Explicit one-time Customer/product mapping creates the real selectable circuit. Existing unique CIDs can be linked without mapping again.
- User screenshot shows CID typed into Cari gejala; current filter correctly produces no matches but form guidance/ordering is poor. Put CID picker first and explain no-match/reset.
- Native implementation chosen after prior agent account/thread limits; no new parallel agents.
- Pending: domain/API, Assets panel + ingestion, Trouble UX, verification.

## Implementation and checks
- Candidate extraction groups complete SAP Subject tokens only. Numeric segments never map customer ownership. Canonical/legacy CID contradictions are flagged as conflicts.
- Read-only Assets panel with source names/tickets, search, pagination and explicit one-time Customer/product/status mapping. No placeholder Customer or inferred product. Existing Service is reused without metadata changes; new circuit defaults Pending unless manager explicitly chooses otherwise.
- Ticket joins use the existing M:N table directly, under per-CID advisory and source-ticket row locks, preserving Ticket age and Service Inventory version. Audit entries do not award points.
- Actual web and EWO integration ticket create hooks auto-link uniquely mapped SAP circuits; unknown circuits remain visible candidates rather than fabricated assets. Link failure does not discard an already-created ticket.
- Trouble now shows CID picker before Gejala/Penyebab, hides duplicate manual customer field, explains optional symptom search, and detects CID typed into the wrong search field with a reset action.
- Root reviewed ACL, SQL parameterization, concurrency, timestamp/score preservation, invalid/ambiguous CIDs and no implicit customer grouping. Fresh independent agent review unavailable after earlier agent/thread limits; not claimed.
- 42 unit tests passed; actual SAP/classification/ServiceWork/outage API fixtures passed; six browser regression suites passed including 320px and wrong-field/reset case. ESLint and diff checks passed.
- Real PostgreSQL scratch test passed: concurrent creation produces one Service, ownership explicit, raw joins preserve Ticket/Service timestamps, future auto-link works, audit failure rolls back Service/links, no points awarded. No production data imported or mapped.
- Build/rollout outcome recorded after server verification; production schema unchanged by this feature.
