# CID Service Work execution ledger

- User approved full input design and requested implementation with “ok kerjakan”. Proceed without another plan approval question, using the already authorized scope.
- Existing codex/trouble-installation-classification branch reused; unrelated local credential-ignore edits and scripts/_fix, scripts/_oct_report retained untouched.
- Ruling: add ServiceWork classification and preserve legacy Installation rather than rewriting production records.
- Ruling: canonical capacity uses Mbps in Service customData with explicit legacy reader; no invented capacity for unknown data.
- Ruling: dynamic product fields use existing ServiceTemplate definitions; only explicitly supplied fields are merged, and historical payload remains on ticket.
- Pending tasks: backend; form/navigation; masters; details/integration; independent review and verification.

## Progress and rulings
- Backend, conditional form, CID entry/history, master management, permissions and detail snapshot/Resolve summary implemented locally.
- Added row locks for Ticket and Service, optimistic Inventory version check, and atomic ticket/Inventory/audit/points transaction. Existing integration Resolve/Closed is explicitly blocked for ServiceWork until shared transactional integration support is implemented; legacy API remains unchanged.
- Ruling: Inventory registration reuses existing authorized /assets/new workflow in a new tab; ticketSetup mode creates Pending circuit and continues to prefilled installation ticket. Avoids introducing a second registration API or granting Inventory rights to ticket-only users.
- Ruling: existing inactive work masters remain valid for the same pending ticket; deactivation only stops new selections. Snapshot label remains historical.
- Ruling: Terminate preserves customData and skips new template-required fields because it does not modify product parameters; cannot change product or capacity in the same termination request.
- Ruling: canonical Mbps takes precedence over legacy aliases; existing explicit aliases are synchronized on apply. CID aliases cannot change through template fields.
- Backend and form subagents ended due to account usage limits; root completed integration and fixes. Independent fresh reviewer dispatch was unavailable (agent thread limit); root performed scope/security/quality review instead. Do not claim independent review passed.
- Actual API fixtures passed atomic rollback, concurrent/repeated Resolve, stale Inventory conflict, reopen idempotency, last-reply point recipient, new EWO generator and fresh master ACL.
- Actual client browser fixtures passed legacy form, master management and ServiceWork operations, 320px layout, category suggestion/manual override, CID prefill and single selection. No production database writes.
- Prisma generated; ESLint passed. Full local build attempted with default Turbopack and webpack, including escalated retry: Windows junction/permission failure and malformed parent C:/Users/hendr/package.json BOM. Parent file not edited. Temporary Next root configuration did not solve it and was reverted.
- Final consolidated regression run: 39/39 unit tests passed; actual ServiceWork/classification/outage API fixture suites passed; ServiceWork form, detail Resolve/edit, masters, legacy ticket form and outage browser suites passed. ESLint exit0; Prisma validate and generate passed. SQL is prepared but not applied on production. Full production build remains environment-blocked as above.
- Root review: fixed unchanged metadata rebasing, canonical capacity/alias conflicts, CID changes through product extras, string template schema validation, immutable applied edit payloads, normalized integration status bypass, ServiceWork report exclusion, inactive master continuation, and termination requirements. Reviewed migration as additive/idempotent transaction; actual PostgreSQL execution deferred to rollout.
