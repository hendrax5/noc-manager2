# Ticket forms and BOD release — 23 October 2026

New ticket forms remove custom parameters, manual company/vendor, priority/type/queue and manual category. Trouble selects multiple CIDs; installation registers customer/circuit atomically; Upgrade/Downgrade retain product and use Gbps/RFS; termination retains history; BOD has explicit start/end WIB and network confirmation.

BOD schedule → confirm activation → confirm normal bandwidth restored → Resolve. Inventory changes only after evidence and confirmation. Overlap, stale snapshots, CID mutation, active-BOD asset edits, early Resolve/Close, deleted evidence, cancelled-ticket phase scoring are guarded. Reminders appear only on dashboard (24h/1h/overdue), refresh every minute while visible, and remain until restore or cancellation.

Company routing uses verified service metadata and effective employee assignment/department mapping; unknown origin stays needs_mapping. ION Customer ID prefix does not imply routing company. No existing customer/company ownership is reassigned.

Migration: scripts/apply_ticket_forms_bod_migration.cjs --apply; additive BodWindow table. Existing category scores retained; Perubahan Layanan defaults to score4. Missing work-type category mappings use existing operation categories. Legacy BOD(Change) is deactivated/renamed; historical snapshots unchanged. Reports remain simulation; department exclusions unchanged.

Verification: 102/102 library tests; work-v2 browser flow, axe WCAG, 320px viewport; Linux production build; restored production dump; real HTTP/PG installation atomic rollback/edit/Resolve, BOD overlap/CID guards/activation/restoration/idempotency/cancellation/Resolve/Close/asset edit/dashboard/auth; same suite against compatible rollback image. Independent review blockers fixed.

Release assets: /opt/noc-manager2/releases/ticket-forms-bod-v1 (root-only backup/env, build logs, HTTP results, compose overrides, rollback.sh). Deploy immutable image using compose override and explicit startup without db push. Refresh pg_dump immediately before migration.

Rollback: run root-only release rollback.sh. Compatibility image keeps all new schema/backend/privacy/BOD lifecycle and dashboard guards, with previous new-ticket form UI; new BOD creation hidden in fallback UI. Existing BOD can be restored and resolved. Keep additive schema and live data. Do not restore backup routinely or use raw release-82dbcfb after BOD data exists; backup restore can discard new transactions and requires separate approval.

Production result (23 October 2026)

- App image `noc-manager2-app:release-bce258b`, OCI revision `bce258b`; 338 runtime/source files verified against git after normalizing CRLF/LF.
- Local/domain authenticated pages, workflow/report APIs, BOD master/API and dashboard PASS; anonymous API access denied.
- Before/after: customers620, services853, circuit identifiers747, BFI services13, tickets28531. Company names preserved: ION, SDC, Sistercompany, Indotel, PRODC.
- Flags preserved: work_phase_enabled=true, structured_daily_enabled=true, monthly_evaluation_mode=simulation; evaluation exclusions4/10/11 unchanged.
- Runtime uses `docker-compose.prod.yml` plus release override; upload volume `noc-manager2_noc_uploads` preserved. First rollout check targeted an obsolete container name and automatically fell back; corrected to production Compose and service-container ID, then redeployed and verified successfully.
- Rollback tested with full isolated HTTP/PG suite. Production rollback command: `sudo /opt/noc-manager2/releases/ticket-forms-bod-v1/rollback.sh`. Do not use development docker-compose.yml, which mounts the working directory and anonymous build volumes.
- QA containers removed after verifying their task labels; QA secret file removed. Production backup and rollback images retained. No test tickets/customer/services written in production.
