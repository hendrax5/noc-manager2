# Version History

Catalog of active, planned, and deprecated versions of the NOC Manager application.

## Active Versions

| Version | Release Date | Status | Description |
|---|---|---|---|
| **v2.2.0** | 2026-06-06 | Active | **Feature & UI Release** - Implemented daily visual Team Work Hours timeline, PIC Diligence/Loyalty analysis scoring, and custom premium scroll-experience. |
| **v2.1.3** | 2026-06-04 | Active | **Feature Release** - Added edit_own_tickets and edit_other_tickets security permissions to roles and enforced them in ticket detail edits on frontend & backend. |
| **v2.1.2** | 2026-06-03 | Active | **Bug Fix Release** - Resolved session caching issue where demoted admin/manager users still see the Administration menu. |
| **v2.1.1** | 2026-06-03 | Active | **Feature Release** - Integrated External API Key configurations into Admin Branding & Preferences settings panel. |
| **v2.1.0** | 2026-06-03 | Active | **Feature & Security Release** - Exposed External Ticket Creation API and added validation checks for ticket status & priority. |
| **v2.0.0** | 2026-06-02 | Active | **Major Release** - Implemented Helicopter View with Tab Switcher on main Dashboard page for executive monitoring. |
| **v1.9.0** | 2026-06-02 | Active | **Bug Fix Release** - Supported PHP Hesk bcrypt ($2y$, $2x$) password hashes in NextAuth login and Profile updates. |
| **v1.8.0** | 2026-06-02 | Active | **Feature Release** - Added resolved tickets default hiding and quick visibility toggle on Live Operations Board. |
| **v1.7.0** | 2026-06-02 | Active | **Feature & Bug Fix Release** - Fixed PIC SearchableSelect focus bug and implemented searchable badged multi-select tag input for Impacting Services. |
| **v1.6.0** | 2026-06-02 | Active | **Feature Release** - Granular ticket and user/role administration capability checklist. |
| **v1.5.0** | 2026-06-02 | Active | **Feature Release** - Database-driven Roles & Permissions system with UI permission checklists. |
| **v1.4.0** | 2026-06-02 | Active | **Feature Release** - Dynamic Dashboard Configuration per department settings (widgets visibility, category filter, default scope overrides). |
| **v1.3.5** | 2026-06-02 | Active | **Bug Fix Release** - Fixed generic status update alert on frontend to parse and render specific error messages from the backend (such as same-day re-open warnings). |
| **v1.3.4** | 2026-06-02 | Active | **Feature & Bug Fix Release** - Added Job Category selector to advanced filters page, synced state from URL query parameters, and fixed dashboard category monitor card links. |
| **v1.3.3** | 2026-06-02 | Active | **Bug Fix Release** - Fixed sign-out and sign-in redirection loop issues, and supported both bcrypt and plain-text passwords for NextAuth credentials provider. |
| **v1.3.2** | 2026-06-02 | Active | **Feature Update** - Integrated Global vs Department scope toggle for CS/Admin users to control ticket dashboard view. |
| **v1.3.1** | 2026-06-02 | Active | **Bug Fix Release** - Fixed ticket deletion caching, ActionItem foreign key constraints, CS role delete permissions, and user management session staleness. Added version display in Navbar. |
| **v1.3.0** | 2026-06-02 | Active | **Dashboard Redesign** - Notes system, Live Ops Board, Job Category tracking, build fixes. |
| **v1.2.2** | 2026-05-15 | Active | Current baseline version prior to redesign. |

## Version Log Detail

### v2.2.0
- **Release Date**: June 6, 2026
- **Prisma Changes**: No
- **Status**: Stable / Verified Build / Team Work Hours Timeline & Loyalty Analysis

### v2.1.3
- **Release Date**: June 4, 2026
- **Prisma Changes**: No
- **Status**: Stable / Verified Build / Granular Ticket Edit Permissions Added

### v2.1.2
- **Release Date**: June 3, 2026
- **Prisma Changes**: No
- **Status**: Stable / Verified Build / Resolved dynamic role updates and navbar caching

### v2.1.1
- **Release Date**: June 3, 2026
- **Prisma Changes**: No
- **Status**: Stable / Verified Build / External API Key configuration UI settings panel

### v2.1.0
- **Release Date**: June 3, 2026
- **Prisma Changes**: No
- **Status**: Stable / Verified Build / External Ticket API & Validation Safeguards

### v2.0.0
- **Release Date**: June 2, 2026
- **Prisma Changes**: No
- **Status**: Stable / Verified Build / Implemented Helicopter View with Tab Switcher on main Dashboard page for executive monitoring

### v1.9.0
- **Release Date**: June 2, 2026
- **Prisma Changes**: No
- **Status**: Stable / Verified Build / PHP Hesk bcrypt ($2y$, $2x$) password hashes in NextAuth login and Profile updates supported

### v1.8.0
- **Release Date**: June 2, 2026
- **Prisma Changes**: No
- **Status**: Stable / Verified Build / Resolved tickets default hiding and quick visibility toggle on Live Operations Board

### v1.7.0
- **Release Date**: June 2, 2026
- **Prisma Changes**: No
- **Status**: Stable / Verified Build / Fixed PIC SearchableSelect focus bug and implemented searchable badged multi-select tag input for Impacting Services

### v1.6.0
- **Release Date**: June 2, 2026
- **Prisma Changes**: No
- **Status**: Stable / Verified Build / Granular ticket actions and administration permissions splitting

### v1.5.0
- **Release Date**: June 2, 2026
- **Prisma Changes**: Yes (added permissions field to Role model)
- **Status**: Stable / Verified Build / Dynamic Roles & Permissions with UI checklists

### v1.4.0
- **Release Date**: June 2, 2026
- **Prisma Changes**: No
- **Status**: Stable / Verified Build / Dashboard configuration per department (widgets, categories list, default scopes)

### v1.3.5
- **Release Date**: June 2, 2026
- **Prisma Changes**: No
- **Status**: Stable / Verified Build / Detailed Alert Errors on Ticket Edits / Same-day resolved re-open validation visibility

### v1.3.4
- **Release Date**: June 2, 2026
- **Prisma Changes**: No
- **Status**: Stable / Verified Build / Job Category filter dropdown and URL sync / Fixed Dashboard Category Card Links

### v1.3.3
- **Release Date**: June 2, 2026
- **Prisma Changes**: No
- **Status**: Stable / Verified Build / Fixed Signout and Signin redirection loops / Supported Bcrypt & Plain-text Passwords

### v1.3.2
- **Release Date**: June 2, 2026
- **Prisma Changes**: No
- **Status**: Stable / Verified Build / Global vs Dept Dashboard Scope Switcher

### v1.3.1
- **Release Date**: June 2, 2026
- **Prisma Changes**: No
- **Status**: Stable / Verified Build / Fixed Delete Bug & Session Caching Staleness

### v1.3.0
- **Release Date**: June 2, 2026
- **Prisma Changes**: Yes (added `TicketNote` model)
- **Status**: Stable / Verified Build

### v1.2.2
- **Release Date**: May 15, 2026
- **Prisma Changes**: No
- **Status**: Legacy Production Baseline

### v1.2.0
- **Release Date**: April 20, 2026
- **Description**: Added SLA Tracking (Phase 22) and Team Scheduler capabilities.
- **Prisma Changes**: Yes

### v1.0.0
- **Release Date**: March 01, 2026
- **Description**: Initial Release of NOC Manager Helpdesk.
