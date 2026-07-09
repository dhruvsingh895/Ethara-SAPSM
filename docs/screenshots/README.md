# Screenshots

Captured from the live deployment at https://ethara-sapsm.vercel.app running against the real 5,000-employee seed dataset on Neon. All shots (except one intentionally in light mode) are dark mode.

| # | File | What it shows |
| --- | --- | --- |
| 1 | [`01-login.png`](01-login.png) | Login page with brand mark, show-password toggle, and dark-mode switch. Credentials are handed out separately in the [User Guide](../USER_GUIDE.md). |
| 2 | [`02-dashboard-top.png`](02-dashboard-top.png) | Dashboard top — the 4 primary stat cards (Occupancy 80%, 4,999 active employees, 50 joiners in 30 days, 24 active projects), the seat-status donut, and the Top Departments horizontal bar chart. |
| 3 | [`03-dashboard-utilization.png`](03-dashboard-utilization.png) | Dashboard bottom — Occupancy-by-floor stacked bars (15 columns: 3 buildings × 5 floors) and the Top Project Utilization table, colour-coded and capped at 100%. |
| 4 | [`04-seats-floor-plan.png`](04-seats-floor-plan.png) | Interactive seat map — B1 Floor 1 with 200 seats laid out by zone, per-status colour coding, filter chips, and a Selection panel showing an occupant plus admin-only "Change status" / "Delete" controls. |
| 5 | [`05-new-joiner-wizard.png`](05-new-joiner-wizard.png) | New Joiner flow — 3-step wizard mid-flow. Step 1 (create or reuse employee), Step 2 (department + optional project), Step 3 (suggested seats ranked by fewest-vacancies-first packing). |
| 6 | [`06-ai-assistant.png`](06-ai-assistant.png) | AI Assistant chat — a natural-language query answered with the count plus a collapsible Generated SQL disclosure, prior history with "Ask again" buttons, and the admin-only "Show all users" toggle. |
| 7 | [`07-employees-list.png`](07-employees-list.png) | Employees list — full-text search, department filter, status filter, paginated table with per-row status badges, plus a "New joiner" shortcut for admin/HR. |
| 8 | [`08-projects-list.png`](08-projects-list.png) | Projects list — 30 seeded projects with codes, clients, status badges, required-seat counts, per-row View links, plus admin's "New project" button and inline delete controls. |
| 9 | [`09-allocations.png`](09-allocations.png) | Allocations — active seat assignments with a full history behind them, filter by employee/seat, an "Active only" toggle, and per-row Release buttons for admin/HR. |
| 10 | [`10-departments.png`](10-departments.png) | Departments admin — canonical list used everywhere in the app (shown here in light mode). Admin can add, rename, or delete; rename cascades to every employee row. |
| 11 | [`11-users.png`](11-users.png) | Users admin — login accounts for the app itself. Admin can create new users (auto-generated password shown once), change roles inline, deactivate, or delete. The admin's own row is deliberately guarded ("you"). |

## What these screenshots demonstrate against the assessment brief

| Requirement | Shown in |
| --- | --- |
| Employee Management | #7 (list, filters, RBAC gates) |
| Project Mapping | #8 (list, staffing, delete/create for admin) |
| Seat Allocation & Release | #4 (floor plan), #9 (release + history) |
| New Joiner Seat Allocation | #5 |
| Search & Filter Functionality | #7 (department substring), #4 (building/floor/status), #9 |
| Dashboard & Analytics | #2, #3 |
| AI Assistant / NL Query | #6 |
| Admin controls (departments, users) | #10, #11 |
| REST APIs | Swagger UI at [`ethara-sapsm.onrender.com/docs`](https://ethara-sapsm.onrender.com/docs) |
| Seed Data | Every screenshot is running against the seeded 5,000-employee dataset |
