# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1] - 2026-06-02

### Added
- **App Version Display**
  - Integrated current package version information (`v1.3.x`) directly into the global navigation bar (`Navbar`).

### Fixed
- **Ticket Deletion Failure (Relation Constraints & Caching & API Permissions)**
  - Fixed ticket delete backend endpoint to gracefully set `linkedTicketId` to `null` for any related `ActionItems`, preventing foreign key constraint errors (500) during database purge.
  - Aligned backend API permissions for DELETE tickets to authorize CS department operators (matching frontend `canModifyTicket` check), and added alert popup on delete failures.
  - Fixed client-side ticket deletion routing cache issue by checking `fetch` status and forcing a full reload (`window.location.href = '/tickets'`) instead of a client-side navigation (`router.push`). This guarantees the deleted ticket immediately disappears from the listing page.
- **User/Team Management Session Staleness**
  - Updated User Management API endpoints (`POST /api/users`, `PATCH /api/users/[id]`, `DELETE /api/users/[id]`) and Admin pages (`/team`, `/settings`) to verify the user's role directly from the database rather than relying on the cached Next-Auth JWT token. This ensures role promotions/overrides (e.g. promoting a user to Admin to manage the team and edit passwords) take effect immediately without requiring the user to log out and log back in.

## [1.3.0] - 2026-06-02

### Added
- **Internal Notes & Activity Log System (Phase 1)**
  - Added `TicketNote` model to database schema (`prisma/schema.prisma`).
  - Added new REST API endpoint for managing internal notes: `POST /api/tickets/[id]/notes` and `GET /api/tickets/[id]/notes`.
  - Added interactive **Activity Timeline** sidebar in Ticket Detail UI.
- **Job Category Monitoring Panel (Phase 2)**
  - Added dashboard support for fetching and displaying active/today/resolved tickets per category.
  - Added job category breakdown charts (stacked bar and donut charts) in `DashboardCharts.js`.
- **CS Live Operations Board (Phase 3)**
  - Added live dashboard tracker (`LiveOpsBoard.js`) mimicking spreadsheet structure.
  - Added real-time filtering (Category, Status, PIC), sorting, and inline note-adding features.
  - Added export to CSV capability.
  - Added API route `GET /api/dashboard/live-ops` to serve board dataset.

### Changed
- **Dashboard Layout Redesign (Phase 4)**
  - Revamped layout to modern, dark-themed UI with glassmorphism effects.
  - Upgraded KPI cards to show *In Progress*, *Resolved Today*, and *Average Time-To-Resolution (TTR)* metrics.
  - Enhanced *Today's Pulse* widget to display aggregate operations.
- **Ticket List & Search (Phase 5)**
  - Added Job Category column in the tickets listing page.
  - Added Job Category multi-select filters and Date Range picker in advanced filters.
  - Added query parameter parsing (`?jobCategory=X`) for seamless click-throughs from dashboard panels.

### Fixed
- **Next.js Build Process**
  - Added `getServerSession` security verification on `/meetings/new` page to force dynamic rendering and resolve local build connection issues caused by database queries on static paths.
