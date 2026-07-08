# Screenshots

Captured from the live deployment at https://ethara-sapsm.vercel.app running against the real 5,000-employee seed dataset on Neon. All shots are dark mode.

| # | File | What it shows |
| --- | --- | --- |
| 1 | [`01-login.png`](01-login.png) | Login page with the 4 pre-configured demo accounts (admin / hr / pm / employee), password shown, brand mark, dark-mode toggle. |
| 2 | [`02-dashboard-top.png`](02-dashboard-top.png) | Dashboard top — the 4 primary stat cards (Occupancy 80%, 5,000 active employees, 50 joiners in 30 days, 23 active projects), seat-status donut chart (Occupied / Available / Reserved / Blocked), and Top Departments horizontal bar chart. |
| 3 | [`03-dashboard-utilization.png`](03-dashboard-utilization.png) | Dashboard bottom — Occupancy-by-floor stacked bar (15 columns: 3 buildings × 5 floors) and the Top Project Utilization table with colour-coded utilization %. |
| 4 | [`04-seats-floor-plan.png`](04-seats-floor-plan.png) | Interactive seat map — B1 Floor 4, 200 seats laid out by zone with per-status colour coding, filter chips at top, legend, and a Selection side panel ready to receive a click. |
| 5 | [`05-new-joiner-wizard.png`](05-new-joiner-wizard.png) | New Joiner allocation flow — 4-step wizard mid-flow. Step 1 (create employee), Step 2 (find a seat by department + optional project id), Step 3 (pick from suggested seats near the QA team). |
| 6 | [`06-ai-assistant.png`](06-ai-assistant.png) | AI Assistant chat — a real NL query ("how many seats for Q&A") answered with the count (412) in 2020 ms plus a collapsible Generated SQL disclosure, previous history entries with "Ask again" buttons, and the admin-only "Show all users" toggle. |
| 7 | [`07-employees-list.png`](07-employees-list.png) | Employees list filtered by department (Engineering) — full-text search, department filter, status filter, paginated table with status badges. |
| 8 | [`08-projects-list.png`](08-projects-list.png) | Projects list — all 30 seeded projects with codes, names, clients (Helix Insurance, Aurora Bank, Ethara Internal, ...), status badges (active / completed), required-seat counts, and per-row View links. |

## What these screenshots demonstrate against the assessment brief

| Requirement | Shown in |
| --- | --- |
| Employee Management | #7 (list), plus RBAC panel visible on #1 |
| Project Mapping | #8 (list, staffing) |
| Seat Allocation & Release | #4 (floor plan), #5 (allocate flow) |
| New Joiner Seat Allocation | #5 |
| Search & Filter Functionality | #7 (department filter), #4 (building/floor/status filter) |
| Dashboard & Analytics | #2, #3 |
| AI Assistant / NL Query | #6 |
| REST APIs | Swagger UI at [`ethara-sapsm.onrender.com/docs`](https://ethara-sapsm.onrender.com/docs) |
| Seed Data | Every screenshot is running against the seeded 5,000-employee dataset |
