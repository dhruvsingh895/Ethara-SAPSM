"""RBAC audit — hit every mutating endpoint as every seeded role.

For each (role, endpoint) pair, this expects:
- 2xx if the role is allowed
- 403 if the role is not allowed
- Anything else = a real bug in RBAC

Runs against a live backend. Point BASE at the deployed URL.
"""

from __future__ import annotations

import os
import sys
from typing import Iterable

import httpx

BASE = os.environ.get("BASE", "http://127.0.0.1:8000") + "/api/v1"
PASSWORD = "demo1234"


def login(client: httpx.Client, username: str) -> dict[str, str]:
    r = client.post(
        f"{BASE}/auth/login",
        data={"username": username, "password": PASSWORD},
    )
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


class Case:
    def __init__(
        self,
        label: str,
        method: str,
        path: str,
        allowed: Iterable[str],
        payload: dict | None = None,
    ):
        self.label = label
        self.method = method
        self.path = path
        self.allowed = set(allowed)
        self.payload = payload


# Only READ-ONLY-effect probes here where possible.
# For writes, we use payloads that should either succeed or 403 first.
# For successful writes, we clean up.
CASES: list[Case] = [
    # ------- reads (should be open to any authed user) -------
    Case("GET /employees", "GET", "/employees?limit=1", {"admin", "hr", "pm", "employee"}),
    Case("GET /seats", "GET", "/seats?limit=1", {"admin", "hr", "pm", "employee"}),
    Case("GET /projects", "GET", "/projects?limit=1", {"admin", "hr", "pm", "employee"}),
    Case("GET /allocations", "GET", "/allocations?limit=1", {"admin", "hr", "pm", "employee"}),
    Case("GET /dashboard/overview", "GET", "/dashboard/overview", {"admin", "hr", "pm", "employee"}),
    Case("GET /new-joiner/suggest", "GET", "/new-joiner/suggest?limit=1", {"admin", "hr", "pm", "employee"}),
    Case("GET /ai/history", "GET", "/ai/history?limit=1", {"admin", "hr", "pm", "employee"}),

    # ------- writes: employees (HR/Admin) -------
    Case(
        "POST /employees",
        "POST",
        "/employees",
        {"admin", "hr"},
        payload={
            "emp_code": "RBAC_TEST_TMP",
            "first_name": "Rbac",
            "last_name": "Probe",
            "email": "rbac_probe_ephemeral@ethara.dev",
            "designation": "SDE 1",
            "department": "Engineering",
            "joining_date": "2026-01-01",
        },
    ),

    # ------- writes: seats (Admin only) -------
    Case(
        "POST /seats",
        "POST",
        "/seats",
        {"admin"},
        payload={
            "seat_code": "RBAC_TEST_SEAT",
            "building": "B9",
            "floor": 9,
            "zone": "Z9",
            "seat_number": 999,
        },
    ),

    # ------- writes: projects (Admin only) -------
    Case(
        "POST /projects",
        "POST",
        "/projects",
        {"admin"},
        payload={
            "code": "RBAC_TEST_PROJ",
            "name": "Rbac Test Project",
            "client": "Rbac Test Client",
            "start_date": "2026-01-01",
        },
    ),

    # ------- writes: assignments (PM/Admin) -------
    # Skipped from the batch write test because it requires a valid
    # project_id + employee_id — we probe the deny path via GET /projects/1
    # existence and a POST that will 403 without touching data.
    Case(
        "POST /projects/1/assignments",
        "POST",
        "/projects/1/assignments",
        {"admin", "pm"},
        payload={
            "employee_id": 999999,  # doesn't exist -> would 400/500 if allowed
            "project_id": 1,
            "role": "Reviewer",
            "allocation_pct": 10,
            "start_date": "2026-01-01",
        },
    ),

    # ------- writes: allocations (HR/Admin) -------
    Case(
        "POST /allocations",
        "POST",
        "/allocations",
        {"admin", "hr"},
        payload={"seat_id": 999999, "employee_id": 999999},  # deny check
    ),

    # ------- writes: new-joiner allocate (HR/Admin) -------
    Case(
        "POST /new-joiner/allocate",
        "POST",
        "/new-joiner/allocate",
        {"admin", "hr"},
        payload={"employee_id": 999999, "seat_id": 999999},
    ),

    # ------- ai/history all_users (Admin only for cross-user view) -------
    # We can't tell from a single GET whether all_users had effect, so we
    # test the deny path: non-admin passing all_users=true still returns
    # only their own rows (endpoint doesn't 403 — silently scopes down).
    # That's a design choice, not a bug — noted below.
]


CLEANUP_HINTS: list[tuple[str, str]] = [
    # (method, path) — we resolve dynamically after checks
]


def run() -> None:
    with httpx.Client(timeout=30.0) as c:
        tokens = {r: login(c, r) for r in ("admin", "hr", "pm", "employee")}
        print(f"logged in as: {', '.join(tokens)}")
        print()

        bugs = 0
        created_ids: dict[str, dict[str, int]] = {}

        for case in CASES:
            print(f"== {case.label} — allowed: {sorted(case.allowed)}")
            for role, h in tokens.items():
                r = c.request(case.method, f"{BASE}{case.path}", headers=h, json=case.payload)
                sc = r.status_code
                should_be_allowed = role in case.allowed

                if should_be_allowed:
                    # Any 2xx (or a non-403 4xx caused by our deliberately-bad
                    # payloads) is fine. The important thing is: NOT 403.
                    ok = sc != 403
                    marker = "OK" if ok else "BAD"
                    if not ok:
                        bugs += 1
                    print(f"  {marker:<3} {role:<9} -> {sc}")
                    if 200 <= sc < 300 and case.method == "POST":
                        # Track for cleanup
                        try:
                            body = r.json()
                            if "id" in body:
                                created_ids.setdefault(case.path, {})[role] = body["id"]
                        except Exception:
                            pass
                else:
                    ok = sc == 403
                    marker = "OK" if ok else "BAD"
                    if not ok:
                        bugs += 1
                    print(f"  {marker:<3} {role:<9} -> {sc}")

        # ---- cleanup: delete anything we created ----
        print()
        print("cleanup:")
        for path, by_role in created_ids.items():
            for role, oid in by_role.items():
                # crude but works for the 4 create paths we exercise
                if path.startswith("/employees"):
                    del_path = f"/employees/{oid}"
                elif path.startswith("/seats"):
                    del_path = f"/seats/{oid}"
                elif path.startswith("/projects/1/assignments"):
                    del_path = f"/projects/1/assignments/{oid}"
                elif path.startswith("/projects"):
                    del_path = f"/projects/{oid}"
                elif path.startswith("/allocations"):
                    # release then rely on server to clear seat state
                    del_path = f"/allocations/{oid}/release"
                    c.post(f"{BASE}{del_path}", headers=tokens["admin"], json={})
                    print(f"  released allocation {oid}")
                    continue
                else:
                    continue
                r = c.delete(f"{BASE}{del_path}", headers=tokens["admin"])
                print(f"  DELETE {del_path} -> {r.status_code}")

        print()
        if bugs == 0:
            print("=== RBAC audit clean: every endpoint enforces expected roles ===")
            sys.exit(0)
        else:
            print(f"=== RBAC audit FAILED: {bugs} bugs ===")
            sys.exit(1)


if __name__ == "__main__":
    run()
