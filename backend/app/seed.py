"""Seed the database with realistic data for grading.

Usage
-----
    python -m app.seed                # seed with default scale (SEED_SCALE env)
    python -m app.seed --wipe         # truncate data tables first (keeps users)
    python -m app.seed --small        # 500 employees / 6 projects (fast)

Design
------
- 3 buildings * 5 floors * 4 zones. ~100 seats per floor per building.
- 8 departments, weighted distribution.
- ~5,000 active + ~300 exited employees.
- 30 projects, long-tail sizes (few big, many small).
- Every active employee: 1-3 assignments summing to <=100%.
- ~80% seat occupancy, ~15% available, ~3% reserved, ~2% blocked.
- Only ACTIVE employees hold a seat.

The generator uses a fixed Faker seed so grading is reproducible.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import random
from datetime import date, datetime, timedelta, timezone
from typing import List

from faker import Faker
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.employee import Employee
from app.models.enums import EmployeeStatus, ProjectStatus, SeatStatus
from app.models.project import Project
from app.models.project_assignment import ProjectAssignment
from app.models.seat import Seat
from app.models.seat_allocation import SeatAllocation

log = logging.getLogger("seed")

BUILDINGS = ["B1", "B2", "B3"]
FLOORS = [1, 2, 3, 4, 5]
ZONES = ["Z1", "Z2", "Z3", "Z4"]
SEATS_PER_ZONE = 25  # 3 * 5 * 4 * 25 = 1500 * 4 zones = 1500 per building; wait: 3*5*4*25 = 1500 total. Adjust:

DEPARTMENTS = [
    ("Engineering", 0.35),
    ("Product", 0.10),
    ("Design", 0.07),
    ("QA", 0.08),
    ("Data", 0.10),
    ("Sales", 0.10),
    ("Ops", 0.10),
    ("HR", 0.05),
    ("Finance", 0.05),
]

DESIGNATIONS = {
    "Engineering": [
        "SDE 1", "SDE 2", "SDE 3", "Senior Engineer", "Staff Engineer",
        "Engineering Manager", "Principal Engineer",
    ],
    "Product": ["Product Analyst", "PM", "Senior PM", "Group PM"],
    "Design": ["Designer", "Senior Designer", "Design Lead"],
    "QA": ["QA Engineer", "Senior QA", "QA Lead", "SDET"],
    "Data": ["Data Engineer", "Data Analyst", "Data Scientist", "ML Engineer"],
    "Sales": ["AE", "Senior AE", "Sales Manager", "SDR"],
    "Ops": ["Ops Analyst", "Ops Manager", "IT Support", "Facilities"],
    "HR": ["HRBP", "HR Manager", "Recruiter"],
    "Finance": ["Accountant", "Finance Analyst", "Finance Manager"],
}

CLIENTS = [
    "Ethara Internal", "Aurora Bank", "Nimbus Retail", "Cascade Health",
    "Vertex Media", "Helix Insurance", "Meridian Logistics", "Polaris Energy",
]

PROJECT_ROLES = ["Developer", "Lead", "Analyst", "Designer", "Reviewer", "SDET"]


def _seat_code(b: str, f: int, z: str, n: int) -> str:
    return f"{b}-F{f}-{z}-S{n:03d}"


def _emp_code(i: int) -> str:
    return f"E{i:05d}"


def _project_code(i: int) -> str:
    return f"PRJ{i:03d}"


def _weighted_choice(rng: random.Random, options: List[tuple[str, float]]) -> str:
    r = rng.random()
    acc = 0.0
    for name, w in options:
        acc += w
        if r <= acc:
            return name
    return options[-1][0]


async def _wipe(db: AsyncSession) -> None:
    """Delete data rows but keep users. Sensitive to FK order."""
    log.info("wiping data tables (keeping users)")
    # Break FK cycle between employees and seats/projects first.
    await db.execute(text("UPDATE employees SET current_seat_id=NULL, current_project_id=NULL"))
    await db.execute(text("UPDATE projects SET pm_id=NULL"))
    await db.execute(delete(SeatAllocation))
    await db.execute(delete(ProjectAssignment))
    await db.execute(text("UPDATE employees SET manager_id=NULL"))
    await db.execute(delete(Employee))
    await db.execute(delete(Project))
    await db.execute(delete(Seat))
    from app.models.department import Department
    await db.execute(delete(Department))
    # Reset PK sequences so codes stay tidy on re-run.
    for table in ("employees", "projects", "seats", "seat_allocations", "project_assignments", "departments"):
        await db.execute(text(f"ALTER SEQUENCE {table}_id_seq RESTART WITH 1"))
    await db.commit()


async def seed(
    db: AsyncSession,
    *,
    employees_target: int = 5000,
    exited_target: int = 300,
    projects_target: int = 30,
    seats_per_zone: int = 50,
    occupancy_pct: float = 0.80,
    reserved_pct: float = 0.03,
    blocked_pct: float = 0.02,
    faker_seed: int = 42,
) -> dict:
    """Populate the DB. Returns a summary dict."""
    fake = Faker()
    Faker.seed(faker_seed)
    rng = random.Random(faker_seed)

    # ---------------- Seats ----------------
    log.info("generating seats")
    seats: list[Seat] = []
    for b in BUILDINGS:
        for f in FLOORS:
            for z in ZONES:
                for n in range(1, seats_per_zone + 1):
                    seats.append(
                        Seat(
                            seat_code=_seat_code(b, f, z, n),
                            building=b,
                            floor=f,
                            zone=z,
                            seat_number=n,
                            status=SeatStatus.AVAILABLE,
                        )
                    )
    db.add_all(seats)
    await db.flush()
    total_seats = len(seats)

    # ---------------- Departments ----------------
    from app.models.department import Department as _Department
    _DEPT_DESCRIPTIONS = {
        "Engineering": "Software, platform, and infrastructure engineering",
        "Product": "Product management and analytics",
        "Design": "Product and brand design",
        "QA": "Quality assurance and test engineering",
        "Data": "Data engineering, analytics, and ML",
        "Sales": "Sales and revenue operations",
        "Ops": "Operations, IT, and facilities",
        "HR": "People operations and recruiting",
        "Finance": "Finance and accounting",
    }
    dept_rows = [
        _Department(name=name, description=_DEPT_DESCRIPTIONS.get(name))
        for name, _ in DEPARTMENTS
    ]
    db.add_all(dept_rows)
    await db.flush()
    log.info("departments: %d", len(dept_rows))
    log.info("seats: %d", total_seats)

    # ---------------- Employees ----------------
    log.info("generating employees")
    employees: list[Employee] = []
    for i in range(1, employees_target + exited_target + 1):
        dept = _weighted_choice(rng, DEPARTMENTS)
        des = rng.choice(DESIGNATIONS[dept])
        joining = fake.date_between(start_date="-8y", end_date="today")
        is_exited = i > employees_target
        emp = Employee(
            emp_code=_emp_code(i),
            first_name=fake.first_name(),
            last_name=fake.last_name(),
            email=f"{_emp_code(i).lower()}@ethara.dev",
            phone=fake.phone_number()[:32],
            designation=des,
            department=dept,
            joining_date=joining,
            status=EmployeeStatus.ACTIVE if not is_exited else EmployeeStatus.EXITED,
            exit_date=(
                fake.date_between(start_date=joining, end_date="today")
                if is_exited else None
            ),
        )
        employees.append(emp)
    db.add_all(employees)
    await db.flush()

    # Manager assignment: some senior folks manage juniors in the same dept.
    seniors_by_dept: dict[str, list[Employee]] = {}
    for e in employees:
        if e.status != EmployeeStatus.ACTIVE:
            continue
        if any(k in e.designation for k in ("Manager", "Lead", "Staff", "Principal", "Senior PM", "Group PM")):
            seniors_by_dept.setdefault(e.department, []).append(e)
    for e in employees:
        if e.status != EmployeeStatus.ACTIVE:
            continue
        pool = seniors_by_dept.get(e.department, [])
        if pool and rng.random() < 0.7:
            candidate = rng.choice(pool)
            if candidate.id != e.id:
                e.manager_id = candidate.id
    await db.flush()
    active_employees = [e for e in employees if e.status == EmployeeStatus.ACTIVE]
    log.info("employees: %d active, %d exited", len(active_employees), exited_target)

    # ---------------- Projects ----------------
    log.info("generating projects")
    projects: list[Project] = []
    for i in range(1, projects_target + 1):
        status = rng.choices(
            [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD, ProjectStatus.COMPLETED],
            weights=[0.75, 0.10, 0.15],
        )[0]
        start = fake.date_between(start_date="-3y", end_date="-30d")
        end = (
            fake.date_between(start_date=start, end_date="today")
            if status == ProjectStatus.COMPLETED
            else None
        )
        projects.append(
            Project(
                code=_project_code(i),
                name=(
                    f"{rng.choice(['Atlas','Nova','Orion','Delta','Echo','Falcon','Titan','Zephyr','Helix','Cypher'])} "
                    f"{rng.choice(['Migration','Platform','Portal','Insights','Sync','Rebuild','Launch','Refresh'])} "
                    f"{i:02d}"
                ),
                client=rng.choice(CLIENTS),
                description=fake.sentence(nb_words=12),
                status=status,
                start_date=start,
                end_date=end,
                # Sized so that after ~207 members/project settle in, the
                # utilization dashboard shows a realistic spread (mostly
                # 60-120%, a few over-allocated, a few under). See ADR notes
                # in docs/perf/README.md.
                required_seats=rng.choice([180, 200, 220, 240, 260, 280, 320]),
            )
        )
    db.add_all(projects)
    await db.flush()

    # Pick PMs from Product department seniors, fallback to any senior.
    product_seniors = [
        e for e in active_employees
        if e.department == "Product" and "PM" in e.designation
    ]
    for p in projects:
        pool = product_seniors or [
            e for e in active_employees if "Manager" in e.designation
        ]
        if pool:
            p.pm_id = rng.choice(pool).id
    await db.flush()
    log.info("projects: %d", len(projects))

    # ---------------- Project assignments ----------------
    log.info("generating project assignments")
    active_projects = [p for p in projects if p.status == ProjectStatus.ACTIVE]
    assignments: list[ProjectAssignment] = []
    # Most employees only touch one project. Keep long-tail small so
    # dashboard utilization numbers stay believable at 5k scale.
    for e in active_employees:
        n_assign = rng.choices([0, 1, 2], weights=[0.10, 0.82, 0.08])[0]
        chosen: set[int] = set()
        remaining = 100
        for _ in range(n_assign):
            if not active_projects or remaining <= 0:
                break
            p = rng.choice(active_projects)
            if p.id in chosen:
                continue
            chosen.add(p.id)
            pct = rng.choice([25, 50, 75, 100])
            if pct > remaining:
                pct = remaining
            remaining -= pct
            start = max(p.start_date, e.joining_date)
            if start > date.today():
                continue
            assignments.append(
                ProjectAssignment(
                    employee_id=e.id,
                    project_id=p.id,
                    role=rng.choice(PROJECT_ROLES),
                    allocation_pct=pct,
                    start_date=start,
                )
            )
        # primary project = one they were first assigned to
        if chosen:
            e.current_project_id = next(iter(chosen))
    db.add_all(assignments)
    await db.flush()
    log.info("assignments: %d", len(assignments))

    # ---------------- Seat allocations ----------------
    log.info("assigning seats to active employees (target %.0f%% occupancy)", occupancy_pct * 100)

    # Mark some seats reserved / blocked upfront.
    rng.shuffle(seats)
    n_reserved = int(total_seats * reserved_pct)
    n_blocked = int(total_seats * blocked_pct)
    for s in seats[:n_reserved]:
        s.status = SeatStatus.RESERVED
    for s in seats[n_reserved : n_reserved + n_blocked]:
        s.status = SeatStatus.BLOCKED
    usable_seats = [s for s in seats if s.status == SeatStatus.AVAILABLE]

    # Target seat count based on occupancy percentage of TOTAL seats.
    target_occupied = int(total_seats * occupancy_pct)
    target_occupied = min(target_occupied, len(active_employees), len(usable_seats))

    # Group employees by department, seats by (building, floor, zone).
    # Assign each department to a small set of preferred zones so
    # teammates cluster (makes new-joiner suggestions meaningful).
    zone_buckets: dict[tuple[str, int, str], list[Seat]] = {}
    for s in usable_seats:
        zone_buckets.setdefault((s.building, s.floor, s.zone), []).append(s)
    all_zones = list(zone_buckets.keys())
    rng.shuffle(all_zones)

    dept_names = [d for d, _w in DEPARTMENTS]
    dept_zones: dict[str, list[tuple[str, int, str]]] = {}
    zones_per_dept = max(2, len(all_zones) // len(dept_names))
    for i, dept in enumerate(dept_names):
        start = (i * zones_per_dept) % len(all_zones)
        dept_zones[dept] = all_zones[start : start + zones_per_dept]

    active_by_dept: dict[str, list[Employee]] = {}
    for e in active_employees:
        active_by_dept.setdefault(e.department, []).append(e)

    allocations: list[SeatAllocation] = []
    allocated_count = 0
    now = datetime.now(timezone.utc)
    for dept, emps in active_by_dept.items():
        rng.shuffle(emps)
        zone_keys = list(dept_zones.get(dept, all_zones))
        # Collect the seats these zones offer, plus a global fallback.
        seat_pool: list[Seat] = []
        for zk in zone_keys:
            seat_pool.extend(zone_buckets.get(zk, []))
        rng.shuffle(seat_pool)
        i_seat = 0
        for e in emps:
            if allocated_count >= target_occupied:
                break
            # find a still-AVAILABLE seat in the pool
            while i_seat < len(seat_pool) and seat_pool[i_seat].status != SeatStatus.AVAILABLE:
                i_seat += 1
            if i_seat >= len(seat_pool):
                break
            seat = seat_pool[i_seat]
            i_seat += 1
            seat.status = SeatStatus.OCCUPIED
            e.current_seat_id = seat.id
            allocations.append(
                SeatAllocation(
                    seat_id=seat.id,
                    employee_id=e.id,
                    allocated_at=now
                    - timedelta(days=rng.randint(1, 400)),
                )
            )
            allocated_count += 1

    # Second pass: if still under target, use any AVAILABLE seat anywhere.
    if allocated_count < target_occupied:
        remaining_seats = [s for s in seats if s.status == SeatStatus.AVAILABLE]
        remaining_emps = [
            e for e in active_employees if e.current_seat_id is None
        ]
        rng.shuffle(remaining_seats)
        rng.shuffle(remaining_emps)
        for seat, e in zip(remaining_seats, remaining_emps):
            if allocated_count >= target_occupied:
                break
            seat.status = SeatStatus.OCCUPIED
            e.current_seat_id = seat.id
            allocations.append(
                SeatAllocation(
                    seat_id=seat.id,
                    employee_id=e.id,
                    allocated_at=now - timedelta(days=rng.randint(1, 400)),
                )
            )
            allocated_count += 1

    db.add_all(allocations)
    await db.flush()
    log.info(
        "seat allocations: %d active (target %d, seats total %d)",
        allocated_count, target_occupied, total_seats,
    )

    await db.commit()

    return {
        "seats": total_seats,
        "employees_active": len(active_employees),
        "employees_exited": exited_target,
        "projects": len(projects),
        "assignments": len(assignments),
        "seat_allocations_active": allocated_count,
    }


async def main(args: argparse.Namespace) -> None:
    settings = get_settings()
    logging.basicConfig(level="INFO", format="%(levelname)s %(name)s %(message)s")

    scale = "small" if args.small else settings.seed_scale
    if scale == "small":
        params = dict(
            employees_target=500,
            exited_target=25,
            projects_target=6,
            seats_per_zone=10,   # 3*5*4*10 = 600
        )
    else:
        params = dict(
            employees_target=5000,
            exited_target=300,
            projects_target=30,
            seats_per_zone=100,  # 3*5*4*100 = 6000
        )

    async with SessionLocal() as db:
        if args.wipe:
            await _wipe(db)
        else:
            existing = (await db.execute(select(Employee).limit(1))).first()
            if existing is not None:
                log.error(
                    "employees table is not empty. Re-run with --wipe to reset, "
                    "or drop the data manually first."
                )
                return
        summary = await seed(db, **params)

    log.info("seed complete: %s", summary)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Ethara SAPSM database.")
    parser.add_argument("--wipe", action="store_true", help="Truncate data tables first (keeps users)")
    parser.add_argument("--small", action="store_true", help="Small dataset for quick iteration")
    asyncio.run(main(parser.parse_args()))
