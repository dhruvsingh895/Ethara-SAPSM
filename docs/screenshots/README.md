# Screenshots

Captured from the live deployment at https://ethara-sapsm.vercel.app running against the real 5,000-employee / 5,500-seat seed on Neon. Almost all shots are dark mode; the Departments shot (#10) is intentionally light so both themes are covered.

| # | File | What it shows |
| --- | --- | --- |
| 1 | [`01-login.png`](01-login.png) | Login page — full brand `Welcome to Ethara Seat Allocation & Project Mapping System`, prefilled `admin` / `demo1234`, show-password toggle, dark-mode switch, and the assessment-only Demo accounts panel with the "would be removed in a real production build" disclaimer. |
| 2 | [`02-dashboard-top.png`](02-dashboard-top.png) | Dashboard top — 4 KPI cards (Occupancy 80%, 5,000 active employees, 50 joiners in 30 days, 25 active projects), the seat-status donut (Occupied 4,400 / Available 825 / Reserved 165 / Maintenance 110 across 5,500 seats), and Top Departments bars (Engineering / Product / Data / Sales / Ops). |
| 3 | [`03-dashboard-utilization.png`](03-dashboard-utilization.png) | Dashboard bottom — Occupancy-by-floor stacked bars (10 columns: 2 buildings × 5 floors) and the Top Project Utilization table with the 5-band gradient badge (amber at 100% at-capacity, emerald through 78–89%). |
| 4 | [`04-seats-floor-plan.png`](04-seats-floor-plan.png) | Interactive seat map — B1 Floor 1 with the new **Highlight dept** and **Highlight project** dropdowns on the toolbar, Selection panel showing seat code, occupant (Michael Hill, DS4000, IT Support · Ops), and admin-only status/delete controls. |
| 5 | [`05-new-joiner-wizard.png`](05-new-joiner-wizard.png) | New Joiner flow — 3-step wizard mid-flow. Step 3's suggested seats use the new zone codes (`B2-F1-ZG-S023`, `B2-F1-ZH-S016`) and the fewest-vacancies-first packing algorithm. |
| 6 | [`06-ai-assistant.png`](06-ai-assistant.png) | AI Assistant chat — a NL query ("total people in building 1?") answered with `The answer is: 2233.` in 1608 ms, spec-shaped top-level `answer` field, collapsible Generated SQL disclosure, and the admin-only "Show all users" toggle. |
| 7 | [`07-employees-list.png`](07-employees-list.png) | Employees list filtered to `department=Engineering` + `status=active`, ILIKE substring search across name/email/code/designation/department, paginated table with role/dept/status badges. |
| 8 | [`08-projects-list.png`](08-projects-list.png) | Projects list — first 12 rows: `PRJ001 Indigo` through `PRJ011 Mered` (all 11 spec-named projects **ACTIVE**), then `PRJ012 Titan Migration 12`. Delete now lives on the detail page only; the list has just search + New project. |
| 9 | [`09-allocations.png`](09-allocations.png) | Allocations — active seat assignments with a full history behind them, filter by employee/seat, "Active only" toggle on, per-row Release buttons for admin/HR. |
| 10 | [`10-departments.png`](10-departments.png) | Departments admin (light mode) — canonical list used everywhere in the app. Admin can add / rename (cascades to every employee row) / delete. |
| 11 | [`11-users.png`](11-users.png) | Users admin — login accounts for the app itself. Admin can create new users (auto-generated password shown once), change roles inline, deactivate, or delete. The admin's own row is deliberately guarded ("you"). |

## What these screenshots demonstrate against the assessment brief

| Requirement | Shown in |
| --- | --- |
| Employee Management | #7 (list, filters, RBAC gates) |
| Project Mapping (§3.2) | #8 (all 11 spec-named projects ACTIVE) |
| Seat Allocation & Release | #4 (floor plan), #9 (release + history) |
| New Joiner Seat Allocation | #5 |
| Search & Filter Functionality | #7 (department + status), #4 (building/floor/status/dept-highlight/project-highlight) |
| Dashboard & Analytics | #2, #3 (spec §3.6 KPIs all rendered) |
| AI Assistant / NL Query | #6 (spec-shaped `answer` field) |
| Admin controls (departments, users) | #10, #11 |
| REST APIs | Swagger UI at [`ethara-sapsm.onrender.com/docs`](https://ethara-sapsm.onrender.com/docs) |
| Seed Data (§6 minimums) | Every screenshot runs against the 5,500-seat / 5,000-employee / 30-project seed. |
