# Navigation and ticket presentation delivery

Approved scope: implement the reviewed noc-navigation-mockup. Seven top-level groups; contextual navigation preserves all existing routes and permission checks. Account controls remain available. Assets retains its existing customer/circuit/product/impact views. Combine Name and Subject in a single ticket detail column without changing stored data or routing identities. Installation view includes old and new installations; contextual create opens the modern form. Internal trouble impact flow is a separate future change, not part of this navigation release.

1. Test navigation permission model and ticket presentation rules before implementation.
2. Implement grouped navigation, contextual links and ticket list presentation; preserve legacy routes and filters.
3. Verify library suite, UI contract, Linux production build, actual authenticated route/mobile/theme interactions.
4. Review final diff. Commit and push the current feature branch. Back up production, deploy immutable image, check HTTP and revision; preserve previous image rollback.

No schema/data migration. No routing/scoring/SLA policy changes. Existing unrelated work stays uncommitted.
