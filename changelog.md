# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.0] - 2026-06-02

### Fixed
- **PIC / Assignee Search Reset**: Fixed a bug in `SearchableSelect` where the dropdown options were overly filtered by the currently selected value when re-opening/focusing. The input search text is now cleared on focus to display all options, and reverts to the selected value upon clicking outside without choosing a new one.

### Added
- **Searchable Badged Multi-Select for Impacting Services**: Replaced the long, vertically scrollable checkbox checklist of services in the new ticket form with a searchable multi-select tag input. Selected services are rendered as clearable badges (with a `✕` button to remove them) and search allows filtering by customer name, service name, or service ID.

## [1.6.0] - 2026-06-02

### Added
- **Granular Ticket & Admin Capabilities Checklists**
  - Split `modify_tickets` permission into distinct granular capabilities: `change_ticket_status` (open/resolve/priority status toggles), `assign_tickets` (assigning to staff/tim), and `change_job_category` (selecting job categories/performance points).
  - Split `manage_users` permission into `manage_users` (managing NOC staff registry accounts) and `manage_roles` (accessing security role checklists and updating capabilities).
  - Refactored ticket details page (`page.js`) and client client component (`TicketDetailClient.js`) to disable or enable status, assignment, and job category selectors independently based on granular capabilities.
  - Implemented server-side validation checks in `api/tickets/[id]` PATCH/DELETE, `api/users`, and `api/roles` endpoints to reject unauthorized attempts to update status, assignments, categories, staff accounts, or role mappings.
  - Aligned database seed config (`seed-permissions.js`) to automatically assign all 13 granular permissions to Admin and 9 to Manager roles.

## [1.5.0] - 2026-06-02

### Added
- **Database-Driven Roles & Permissions System**
  - Migrated the application's access control (RBAC) checks from hardcoded role comparisons (e.g. `role === 'Admin'`) to dynamic, database-driven capability checks (e.g. `permissions.includes('...')`).
  - Added `permissions` (JSON array) field to the `Role` model in the database schema.
  - Implemented initial migration & seeding script (`seed-permissions.js`) to set up capabilities for default Admin and Manager roles.
  - Attached permissions dynamically to the user session securely inside NextAuth JWT and session callbacks.
  - Added a premium, dynamic checklist UI in Team Management for editing and toggling specific capabilities on user roles dynamically.
  - Refactored 20+ files across Reports, Roster Schedules, Meetings, Knowledge Base, and Customer Assets/Topology components to enforce the dynamic permissions model.

## [1.4.0] - 2026-06-02

### Added
- **Dynamic Dashboard Configuration per Department**
  - Integrated "Dashboard Settings" tab in Helpdesk settings page, enabling Admin users to configure widgets, monitored job categories, and default ticket scopes per department.
  - Dynamically controls visibility of dashboard widgets (KPI Cards, Job Category Monitor, Live Operations Board, My Follow-Ups, Weekly Shifts, Analytics Trends) based on user department settings.
  - Enforced department-specific Job Category filtering on all dashboard stats, charts, and metrics.
  - Enforced department-specific Default Scope overrides (Global, Dept, Me) on dashboard loading and secured URLs scope transitions.

## [1.3.5] - 2026-06-02

### Fixed
- **Descriptive Error Alert for Ticket Status Updates**
  - Updated `TicketDetailClient.js` to parse and display specific backend API error responses (`res.json().error`) on status changes instead of showing a generic "Failed to auto-update ticket property." error message.
  - This informs the user of actual business rules, such as the system's same-day re-open restriction for resolved tickets: *"Cannot Re-Open or Modify a Ticket that was designated 'Resolved' on the exact same chronological Date..."*

## [1.3.4] - 2026-06-02

### Added
- **Job Category Dropdown in Advanced Filters**
  - Integrated a new "Job Category" dropdown filter selector in the advanced filter panel on the tickets page (`TicketAdvancedFilter.js`).
  - Added dynamic state synchronization in advanced filters using a `useEffect` watching search parameters to keep checkboxes and dropdowns in sync with client-side URL changes.

### Fixed
- **Dashboard Category Monitor Card Links**
  - Fixed Job Category Monitor card links in `page.js` to correctly append `&jobCategory=...` to the URL. This resolved the issue where clicking "Installasi" or other category cards listed unrelated categories on the tickets page.

## [1.3.3] - 2026-06-02

### Fixed
- **Authentication & Login Redirect Loop (Sign out/Sign in Issue)**
  - Fixed Next.js client-side router cache staleness loops by replacing client-side `router.push("/")` with a full-page window redirect (`window.location.href = "/"`) on successful login.
  - Replaced manual sign-out redirection in `Navbar.js` with NextAuth's native `signOut({ callbackUrl: '/login' })` method to ensure cookies and local states are cleared cleanly and synchronously.
- **Credentials Password Support (Bcrypt & Plain-text)**
  - Updated NextAuth credentials authorization logic to support both bcrypt-hashed passwords (used for imported Hesk users) and plain-text passwords (used for seeded/manually created users), preventing login failures due to password hashing mismatches.

## [1.3.2] - 2026-06-02

### Added
- **Global vs Department Dashboard Scope Toggle**
  - Integrated a premium, modern pill-styled Toggle on the dashboard header for CS, Admin, and Manager users to control the query context.
  - Users with global access can switch between the **Global** scope (viewing all tickets across the system) and the **Dept** scope (viewing only tickets assigned to them or their department).
  - Non-global staff (technicians, engineers, etc.) are restricted strictly to their assigned tickets with no toggle available.
  - Linked selected scope to the Live Operations Board widget, ensuring dynamic table re-fetching on toggle state change.

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
