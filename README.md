# NOC Manager v2 (Version 1.3.1)

A comprehensive Enterprise Ticketing, Operations, and Analytics suite designed exclusively for internal NOC, Customer Service, and B2B Technical Support Teams.

## 🚀 What's New in v1.3.0 & v1.3.1?

### 1. 📊 Complete Dashboard Redesign & Premium Layout
- **Glassmorphic Hero Header:** Personal welcome message, visual role/department badges, and quick ticket creation shortcut.
- **Enhanced KPI Cards:** Visual grids tracking *New*, *In Progress*, *Pending*, *Resolved Today*, and *Average Time-To-Resolution (TTR)* with 7-day sparkline micro-trends.
- **Job Category Monitoring Grid:** Real-time breakdown of active/daily ticket workloads per Job Category (e.g., Installation, Upgrade, Relocation, Trouble Ticket) with visual progress meters and SLA warnings.
- **CS Live Operations Board:** A real-time spreadsheet-like operational table that completely replaces legacy Excel sheets, featuring sorting, advanced filters (Date Range, PIC, Category, Status), inline quick-note inserts, and one-click CSV exporting.

### 2. 📝 Ticket Notes & Activity Timeline
- **Internal Notes System:** Integrated internal activity log on tickets, removing external tool/scratchpad dependencies for follow-up notes.
- **Timeline UI:** Audit-style vertical timeline for notes in the Ticket Detail page with distinct note types (escalation, follow-up, internal, customer update).

### 3. 🔧 Crucial Bug Fixes & Session Resolvers (v1.3.1)
- **Cascade Deletions & ActionItems:** Disconnected ActionItem references automatically upon ticket deletion, preventing database foreign key constraints (500) from blocking purges.
- **Next.js Route Cache Fix:** Forced clean HTTP redirects (`window.location.href`) and checked response statuses on ticket deletion, correcting the Next.js router cache bug where deleted tickets still appeared in lists.
- **User Role Overrides Caching:** Modified Admin pages (`/team`, `/settings`) and User APIs to fetch roles dynamically from the database instead of Next-Auth JWT cache. This allows administrator role overrides and promotions to take effect instantly without requiring logout/login.
- **Navbar Version Indicator:** Directly integrated the current version number from `package.json` into the global Navbar header.

---

## 🚀 What's New in v1.2.0?

This release focuses on heavily expanding Administrative control, optimizing massive SSR architectures via Asynchronous Lookups, resolving Universal Mobile Responsiveness, and securing a fully unified CI/CD deployment pipeline.

### 1. ⚙️ Dynamic Administrative Control
- **Custom Application Branding:** Administrators can alter the Core App Name directly from the Settings Panel. Changes natively propagate to the Login Panel and Navbar dynamically without rebuilding the Docker container.
- **Enterprise Database Archival (Backup & Restore):** Implemented isolated JSON chunking allowing full-schema Table Exports and precise `TRUNCATE CASCADE` reinstatements over Web APIs directly from the browser.
- **Factory Reset Protocol:** Admins can selectively wipe Transactional (Tickets/Meetings) bounds, Asset topologies, or generic Human Resources (while protecting their Root account) securely.

### 2. 🔍 Asynchronous Remote Parameter Macros (Ticketing)
- **`@Customers` Debounced Search:** Dropdown Fields assigned with this magic string transform into a Remote Async Autocomplete Component, querying ILIKE clauses resolving instantly without bloating React client memory.
- **`@ServiceTemplates` Bindings:** Automatic bridging of Active Service Assets onto Ticket Instantiation drop-downs.

### 3. 🍔 Global UI/UX & Native Responsive Reflows
- **Hamburger Collapsible Menus:** Collapsible checkbox menus for tactile CSS-driven mobile responsiveness.
- **Enterprise Menu Grouping:** Menu organization into `Resources ▾` and `Administration ▾` Dropdowns.
- **Data Table Horizons:** Static tables deploy `-webkit-overflow-scrolling` bindings resolving tight screen squeezing natively.
- **Strict Antigravity Dark Mode Integration:** Eradicated generic white backgrounds, replaced precisely with theme variables.

### 4. 🚢 Automated CI/CD Publishing
- Bridged `.github/workflows/publish.yml` running onGit Tag creation (`v*.*.*`).
- Auto-generates `Dockerfile` matrix bindings pushing `ghcr.io/hendrax5/noc-manager2:latest` automatically.

## 🚀 Instalasi & Deployment (Production)

Pastikan Server Anda sudah terinstall **Docker** dan **Docker Compose**.

1. Clone repository ini:
   ```bash
   git clone https://github.com/hendrax5/noc-manager2.git
   cd noc-manager2
   ```

2. Buat file `.env` di root folder dengan konfigurasi riil (Ubah *Secret* jika perlu):
   ```bash
   DATABASE_URL="postgresql://postgres:postgrespassword@db:5432/nocticketing?schema=public"
   NEXTAUTH_SECRET="my_super_secret_key_123"
   NEXTAUTH_URL="http://tiket.contoh.com"
   ```

3. Jalankan Docker Compose untuk mode *Production* (Otomatis mereplikasi skema, membangun *build*, dan menjalankan server):
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. Akses aplikasi melalui browser di **http://tiket.contoh.com** (Pastikan mapping DNS/Hosts file Anda sudah mengarah ke IP *Server* ini).

## 🛠 Info Volume & Backup
Sistem menggunakan Persistent Volumes Docker untuk menghindari hilangnya data saat container di-*restart*:
- **Database:** `noc_db_data`
- **Uploads/File Attachments:** `noc_uploads` (Ter-mapping ke `/app/public/uploads`)

## License
Proprietary / Internal Use Only.
