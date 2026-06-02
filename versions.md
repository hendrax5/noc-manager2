# Version History

Catalog of active, planned, and deprecated versions of the NOC Manager application.

## Active Versions

| Version | Release Date | Status | Description |
|---|---|---|---|
| **v1.3.1** | 2026-06-02 | Active | **Bug Fix Release** - Fixed ticket deletion caching, ActionItem foreign key constraints, CS role delete permissions, and user management session staleness. Added version display in Navbar. |
| **v1.3.0** | 2026-06-02 | Active | **Dashboard Redesign** - Notes system, Live Ops Board, Job Category tracking, build fixes. |
| **v1.2.2** | 2026-05-15 | Active | Current baseline version prior to redesign. |

## Version Log Detail

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
