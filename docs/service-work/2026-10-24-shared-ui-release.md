# Shared NOC interface polish

The deployed application uses the approved service mockup's restrained system typography, compact spacing, flat surfaces, quieter tables, and shared form controls. Existing routes, navigation groups, permissions, ticket workflows, SLA calculations, scoring, and stored inventory are preserved.

## Changes

- `app/ui-tokens.css` owns the light/dark palette and scale. Existing CSS aliases point to these tokens.
- `app/ui-foundation.css` standardizes controls, surfaces, navigation, responsive containment and print boundaries. ION report branding/print styles remain intact.
- `app/legacy-ui.css` contains static visual declarations extracted from legacy React inline styles. Dynamic layout and state remain in React. Extraction was a one-time migration; do not regenerate the tuned stylesheet from migrated JSX.
- All page entrypoints receive the shared theme through the root layout. Google font downloads are removed in favor of the mockup's system font stack.
- `CapacityInput` presents one Kapasitas field with an automatic pair/Gbps suffix. Existing pair and Mbps storage/validation remain; Gbps display converts back to Mbps on asset edits.
- Dashboard, Knowledge and ticket detail reflow on narrow screens. Tables scroll within their own region. Decoration and unnecessary shadows are reduced.
- Shift/department default palettes are presentation tokens. Manager-selected highlight hex values and save payloads remain unchanged; their foreground remains readable in dark mode.

## Verification evidence

- 118 library tests passed.
- 13 active UI suites passed, including their keyboard, axe and reflow assertions.
- 219 app/component JS/JSX files parse; shared token references resolve.
- 26/26 declared light/dark text contrast pairs measured at least 4.5:1.
- 32 authenticated route URLs measured at desktop/mobile, plus six dark-theme views: 70 renders returned HTTP200 with no document overflow at320px and no server digest errors.
- 38 real-render text-contrast checks (all desktop routes plus six dark views) reported zero failures.
- Real QA interactions cover Kapasitas pair/Gbps,1/10 defaults, one input border, customer max10/Escape, reflow280/320/414, theme switch, inventory listbox/Escape, mobile menu and public login. No client errors observed.
- Linux production build succeeded. Fresh read-only review found the migrated surface/foreground mismatch; corrected and tested. Follow-up review found no color-persistence regression.

These checks do not constitute a full screen-reader certification or a performance benchmark. The route sweep uses an Admin QA session; role-specific behavior is also covered by existing unit/UI fixtures rather than a full route sweep for every role.

Two historical scripts (`test_service_work_ui.cjs`, `test_ticket_classification_ui.cjs`) target an older TicketForm harness and lack CSS module output configuration. Their baseline compile failures are not counted as passes; the current form is covered by `test_work_type_forms_v2.cjs` and the actual QA interaction suite.

## Rollout and rollback

No schema/data migration is required. Release directory: `/opt/noc-manager2/releases/shared-ui-polish`. Retain a fresh PostgreSQL dump, immutable new/previous app image and production Compose overrides. `rollback.sh` restores app image `release-7747f24`; it does not restore an old database or alter inventory. Keep the production uploads volume mounted. Check deployed revision, source manifest, local/domain HTTP and uploads after rollout. QA uses a cloned database and an independent auth secret; remove the QA containers, temporary auth file and tunnel after verification.
