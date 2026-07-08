"""Phase 2 end-to-end smoke test.

Runs against http://127.0.0.1:8000 with the seeded admin user. Creates
one seat, one project, one employee, one assignment, and verifies each
step. Idempotent — uses a unique run_id so re-runs don't collide.
"""

from __future__ import annotations

import sys
import time
from datetime import date

import httpx

BASE = "http://127.0.0.1:8000/api/v1"


def die(msg: str, resp: httpx.Response | None = None) -> None:
    print(f"FAIL: {msg}")
    if resp is not None:
        print(f"  status: {resp.status_code}")
        try:
            print(f"  body:   {resp.json()}")
        except Exception:
            print(f"  body:   {resp.text[:400]}")
    sys.exit(1)


def check(cond: bool, msg: str, resp: httpx.Response | None = None) -> None:
    if not cond:
        die(msg, resp)
    print(f"OK   {msg}")


def main() -> None:
    run_id = str(int(time.time()))[-6:]
    with httpx.Client(timeout=15.0) as c:
        # --- login ---
        r = c.post(
            f"{BASE}/auth/login",
            data={"username": "admin", "password": "demo1234"},
        )
        check(r.status_code == 200, "admin login", r)
        token = r.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}

        # --- unauthed list rejected ---
        r = c.get(f"{BASE}/employees")
        check(r.status_code == 401, "list employees requires auth", r)

        # --- create seat ---
        seat_payload = {
            "seat_code": f"B1-F1-Z1-S{run_id}",
            "building": "B1",
            "floor": 1,
            "zone": "Z1",
            "seat_number": int(run_id),
            "status": "available",
        }
        r = c.post(f"{BASE}/seats", json=seat_payload, headers=h)
        check(r.status_code == 201, "create seat", r)
        seat = r.json()
        seat_id = seat["id"]

        # duplicate rejected
        r = c.post(f"{BASE}/seats", json=seat_payload, headers=h)
        check(r.status_code == 409, "duplicate seat_code rejected", r)

        # --- list seats + filter ---
        r = c.get(f"{BASE}/seats", params={"building": "B1", "floor": 1}, headers=h)
        check(r.status_code == 200 and r.json()["total"] >= 1, "list seats filtered", r)

        # available list includes new seat
        r = c.get(f"{BASE}/seats/available", params={"building": "B1"}, headers=h)
        check(
            r.status_code == 200
            and any(s["id"] == seat_id for s in r.json()["items"]),
            "seat appears in /seats/available",
            r,
        )

        # --- create employee ---
        emp_payload = {
            "emp_code": f"EMP{run_id}",
            "first_name": "Test",
            "last_name": f"User{run_id}",
            "email": f"test{run_id}@example.com",
            "designation": "SDE",
            "department": "Engineering",
            "joining_date": str(date.today()),
        }
        r = c.post(f"{BASE}/employees", json=emp_payload, headers=h)
        check(r.status_code == 201, "create employee", r)
        emp_id = r.json()["id"]

        r = c.get(
            f"{BASE}/employees",
            params={"q": f"EMP{run_id}", "department": "Engineering"},
            headers=h,
        )
        check(
            r.status_code == 200 and r.json()["total"] == 1,
            "search employees by q and department",
            r,
        )

        # --- create project ---
        proj_payload = {
            "code": f"PRJ{run_id}",
            "name": f"Test Project {run_id}",
            "client": "Ethara Internal",
            "start_date": str(date.today()),
            "required_seats": 5,
        }
        r = c.post(f"{BASE}/projects", json=proj_payload, headers=h)
        check(r.status_code == 201, "create project", r)
        proj_id = r.json()["id"]

        # --- assign employee to project ---
        assign_payload = {
            "employee_id": emp_id,
            "project_id": proj_id,
            "role": "Developer",
            "allocation_pct": 100,
            "start_date": str(date.today()),
        }
        r = c.post(
            f"{BASE}/projects/{proj_id}/assignments",
            json=assign_payload,
            headers=h,
        )
        check(r.status_code == 201, "assign employee to project", r)
        assign_id = r.json()["id"]

        # --- roster ---
        r = c.get(f"{BASE}/projects/{proj_id}/roster", headers=h)
        check(
            r.status_code == 200
            and any(a["id"] == assign_id for a in r.json()["items"]),
            "roster contains new assignment",
            r,
        )

        # --- update employee (patch department) ---
        r = c.patch(
            f"{BASE}/employees/{emp_id}",
            json={"department": "Platform"},
            headers=h,
        )
        check(
            r.status_code == 200 and r.json()["department"] == "Platform",
            "patch employee department",
            r,
        )

        # --- non-admin cannot delete a project ---
        rlogin = c.post(
            f"{BASE}/auth/login",
            data={"username": "employee", "password": "demo1234"},
        )
        emp_token = rlogin.json()["access_token"]
        r = c.delete(
            f"{BASE}/projects/{proj_id}",
            headers={"Authorization": f"Bearer {emp_token}"},
        )
        check(r.status_code == 403, "employee cannot delete project", r)

        # ---------- Phase 3: allocation flows ----------
        # Need a second seat for the transfer test.
        seat2_payload = {
            **seat_payload,
            "seat_code": f"B1-F1-Z1-T{run_id}",
            "seat_number": int(run_id) + 1,
        }
        r = c.post(f"{BASE}/seats", json=seat2_payload, headers=h)
        check(r.status_code == 201, "create second seat for transfer", r)
        seat2_id = r.json()["id"]

        # allocate
        r = c.post(
            f"{BASE}/allocations",
            json={"seat_id": seat_id, "employee_id": emp_id, "note": "smoke"},
            headers=h,
        )
        check(r.status_code == 201, "allocate seat", r)
        alloc_id = r.json()["id"]

        # seat should now be OCCUPIED
        r = c.get(f"{BASE}/seats/{seat_id}", headers=h)
        check(
            r.status_code == 200 and r.json()["status"] == "occupied",
            "seat is OCCUPIED after allocate",
            r,
        )

        # employee.current_seat_id should be set
        r = c.get(f"{BASE}/employees/{emp_id}", headers=h)
        check(
            r.status_code == 200 and r.json()["current_seat_id"] == seat_id,
            "employee.current_seat_id set",
            r,
        )

        # double-allocation of same employee is blocked
        r = c.post(
            f"{BASE}/allocations",
            json={"seat_id": seat2_id, "employee_id": emp_id},
            headers=h,
        )
        check(r.status_code == 409, "cannot double-allocate employee", r)

        # transfer to seat2
        r = c.post(
            f"{BASE}/allocations/transfer",
            json={"employee_id": emp_id, "new_seat_id": seat2_id, "note": "transfer"},
            headers=h,
        )
        check(r.status_code == 200, "transfer to new seat", r)
        new_alloc_id = r.json()["id"]

        r = c.get(f"{BASE}/seats/{seat_id}", headers=h)
        check(r.json()["status"] == "available", "old seat back to AVAILABLE", r)
        r = c.get(f"{BASE}/seats/{seat2_id}", headers=h)
        check(r.json()["status"] == "occupied", "new seat is OCCUPIED", r)

        # release the current allocation
        r = c.post(f"{BASE}/allocations/{new_alloc_id}/release", json={}, headers=h)
        check(r.status_code == 200 and r.json()["released_at"] is not None,
              "release allocation", r)

        r = c.get(f"{BASE}/employees/{emp_id}", headers=h)
        check(r.json()["current_seat_id"] is None,
              "employee.current_seat_id cleared after release", r)

        # ---------- Phase 3: new joiner suggestion ----------
        r = c.post(
            f"{BASE}/new-joiner/suggest",
            json={"department": "Platform", "limit": 5},
            headers=h,
        )
        check(r.status_code == 200 and isinstance(r.json(), list),
              "new-joiner suggest returns a list", r)

        # ---------- Phase 3: dashboard ----------
        r = c.get(f"{BASE}/dashboard/occupancy", headers=h)
        check(r.status_code == 200 and "occupancy_pct" in r.json(),
              "dashboard occupancy", r)

        r = c.get(f"{BASE}/dashboard/occupancy/by-floor", headers=h)
        check(r.status_code == 200 and isinstance(r.json(), list),
              "dashboard occupancy by floor", r)

        r = c.get(f"{BASE}/dashboard/projects/utilization", headers=h)
        check(r.status_code == 200 and isinstance(r.json(), list),
              "dashboard project utilization", r)

        r = c.get(f"{BASE}/dashboard/overview", headers=h)
        j = r.json()
        check(
            r.status_code == 200
            and "occupancy" in j
            and "active_employees" in j
            and "top_departments" in j,
            "dashboard overview shape",
            r,
        )

        # --- cleanup ---
        r = c.delete(
            f"{BASE}/projects/{proj_id}/assignments/{assign_id}", headers=h
        )
        check(r.status_code == 200, "delete assignment", r)
        r = c.delete(f"{BASE}/projects/{proj_id}", headers=h)
        check(r.status_code == 200, "delete project", r)
        r = c.delete(f"{BASE}/employees/{emp_id}", headers=h)
        check(r.status_code == 200, "delete employee", r)
        r = c.delete(f"{BASE}/seats/{seat_id}", headers=h)
        check(r.status_code == 200, "delete seat", r)
        r = c.delete(f"{BASE}/seats/{seat2_id}", headers=h)
        check(r.status_code == 200, "delete second seat", r)

        print("\nAll smoke checks passed (Phase 1-3).")


if __name__ == "__main__":
    main()
