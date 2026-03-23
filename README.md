# NOC Manager v2 (Version 1.2.0)

A comprehensive Enterprise Ticketing, Operations, and Analytics suite designed exclusively for internal NOC, Customer Service, and B2B Technical Support Teams.

## 🚀 What's New in v1.2.0?

This release focuses on heavily expanding Administrative control, optimizing massive SSR architectures via Asynchronous Lookups, resolving Universal Mobile Responsiveness, and securing a fully unified CI/CD deployment pipeline.

### 1. ⚙️ Dynamic Administrative Control
- **Custom Application Branding:** Administrators can alter the Core App Name directly from the Settings Panel. Changes natively propagate to the Login Panel and Navbar dynamically without rebuilding the Docker container.
- **Enterprise Database Archival (Backup & Restore):** Implemented isolated JSON chunking allowing full-schema Table Exports and precise `TRUNCATE CASCADE` reinstatements over Web APIs directly from the browser.
- **Factory Reset Protocol:** Admins can selectively wipe Transactional (Tickets/Meetings) bounds, Asset topologies, or generic Human Resources (while protecting their Root account) securely.

### 2. 🔍 Asynchronous Remote Parameter Macros (Ticketing)
- **`@Customers` Debounced Search:** Custom Dropdown Fields assigned with this magic string transform into a Remote Async Autocomplete Component. To prevent SSR crash looping on a 5000+ Customer database, it enforces a 3-character threshold querying native ILIKE clauses resolving instantly without bloating React client memory.
- **`@ServiceTemplates` Bindings:** Automatic bridging of Active Service Assets onto Ticket Instantiation drop-downs.

### 3. 🍔 Global UI/UX & Native Responsive Reflows
- **Hamburger Collapsible Menus:** Swapped clunky legacy horizontal flex-scrolling out for tactile CSS-driven Mobile Checkbox layers. 
- **Enterprise Menu Grouping:** Massive top-level menus have been efficiently organized into `Resources ▾` and `Administration ▾` Dropdown contexts flattening cognitive overhead.
- **Data Table Horizons:** Static tables now deploy `-webkit-overflow-scrolling` bindings universally resolving tight screen squeezing natively.
- **Strict Antigravity Dark Mode Integration:** Eradicated hardcoded generic `<input>` and `<card>` white backgrounds replacing them precisely into `var(--card-bg)` matching VSCode and Antigravity variables (`#1e1e1e`, `#252526`) flawlessly.

### 4. 🚢 Automated CI/CD Publishing
- Bridged `.github/workflows/publish.yml` automatically running upon any native Git Tag creation (`v*.*.*`).
- Auto-generates lightweight `Dockerfile` matrix bindings explicitly pushing `ghcr.io/hendrax5/noc-manager2:latest` natively.
- Deploys localized App scopes directly into GitHub NPM Packages seamlessly.

## Getting Started

1. Clone repository
2. Populate `.env`:
   ```bash
   DATABASE_URL="postgresql://user:pass@host/db"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="long_random_string"
   ```
3. Run migrations and dev server:
   ```bash
   npx prisma db push
   npm run dev
   ```

## License
Proprietary / Internal Use Only.
