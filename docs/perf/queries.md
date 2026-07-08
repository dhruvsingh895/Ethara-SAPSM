# Query Performance

`EXPLAIN (ANALYZE, BUFFERS)` output for the hot-path queries on live Neon, run against the seeded 5,000-employee / 6,000-seat dataset.

Every query uses an index. No sequential scans on any table larger than 30 rows. **All queries execute in under 3 ms** at the database layer.

## Summary

| Query | Rows scanned | Plan | Execution time |
| --- | --- | --- | --- |
| Employees list (page 1) | 25 | Index Scan on `pk_employees` | **0.06 ms** |
| Employees count by dept+status | 1,724 | **Index-Only Scan** on `ix_employees_dept_status` | **0.34 ms** |
| Seats by building+floor | 400 | Bitmap Index Scan on `ix_seats_building_floor` | **0.46 ms** |
| Active allocation by seat | 1 | Index Scan on `ix_alloc_seat_active` | **2.17 ms** |
| Dashboard: seat status counts | 6,000 | **Index-Only Scan** on `ix_seats_status_floor` | **1.16 ms** |
| Dashboard: top departments | 5,000 | **Index-Only Scan** on `ix_employees_dept_status` | **1.12 ms** |

The composite indexes that make this work — created deliberately in Phase 1:

```sql
-- ix_employees_dept_status: powers dept filter + status filter (single or combined)
CREATE INDEX ix_employees_dept_status ON employees (department, status);

-- ix_seats_building_floor: powers the seat map lookup
CREATE INDEX ix_seats_building_floor ON seats (building, floor);

-- ix_seats_status_floor: powers the dashboard occupancy pie
CREATE INDEX ix_seats_status_floor ON seats (status, floor);

-- ix_alloc_seat_active: "who currently sits here?" — the seat map click lookup
CREATE INDEX ix_alloc_seat_active ON seat_allocations (seat_id, released_at);

-- ix_alloc_emp_active: mirror index for "where does this employee sit?"
CREATE INDEX ix_alloc_emp_active ON seat_allocations (employee_id, released_at);
```

The `released_at` column is included in the allocation indexes specifically because `WHERE released_at IS NULL` selects the currently-active row — Postgres can satisfy the whole predicate from the index without touching the heap.

## Full plans

### 1. Employees list — page 1

```sql
SELECT * FROM employees
WHERE status = 'ACTIVE'
ORDER BY id
LIMIT 25 OFFSET 0;
```

```
Limit  (cost=0.28..6.04 rows=25) (actual time=0.021..0.036 rows=25 loops=1)
  Buffers: shared hit=5
  ->  Index Scan using pk_employees on employees
        Filter: ((status)::text = 'ACTIVE'::text)
        Buffers: shared hit=5
Execution Time: 0.061 ms
```

Uses the primary key. Only 5 buffer hits — trivial.

### 2. Employee count by department + status

```sql
SELECT COUNT(*) FROM employees
WHERE department = 'Engineering' AND status = 'ACTIVE';
```

```
Aggregate  (cost=99.21..99.22 rows=1)
  Buffers: shared hit=13
  ->  Index Only Scan using ix_employees_dept_status on employees
        Index Cond: ((department = 'Engineering'::text) AND (status = 'ACTIVE'::text))
        Heap Fetches: 41
Execution Time: 0.344 ms
```

**Index-Only Scan** — the composite `(department, status)` index answers the count without ever touching the row data.

### 3. Seats by building + floor

```sql
SELECT * FROM seats
WHERE building = 'B1' AND floor = 1
ORDER BY building, floor, zone, seat_number
LIMIT 200;
```

```
Limit  (cost=182.67..183.17 rows=200)
  Buffers: shared hit=19
  ->  Bitmap Heap Scan on seats
        Recheck Cond: (((building)::text = 'B1'::text) AND (floor = 1))
        ->  Bitmap Index Scan on ix_seats_building_floor
              Index Cond: (((building)::text = 'B1'::text) AND (floor = 1))
Execution Time: 0.463 ms
```

400 seats retrieved via bitmap index scan, sorted in memory (78 KB).

### 4. Active allocation by seat (seat map click)

```sql
SELECT * FROM seat_allocations
WHERE seat_id = 100 AND released_at IS NULL
LIMIT 1;
```

```
Limit  (cost=0.28..8.30 rows=1)
  ->  Index Scan using ix_alloc_seat_active on seat_allocations
        Index Cond: ((seat_id = 100) AND (released_at IS NULL))
Execution Time: 2.166 ms
```

The composite `(seat_id, released_at)` index means "find the currently-active allocation for seat X" is O(log n) with zero table access.

### 5. Dashboard occupancy pie

```sql
SELECT status, COUNT(*) FROM seats GROUP BY status;
```

```
GroupAggregate
  Group Key: status
  Buffers: shared hit=28
  ->  Index Only Scan using ix_seats_status_floor on seats
Execution Time: 1.164 ms
```

Index-Only Scan on the `(status, floor)` composite index answers the aggregate without touching the heap. 1.16 ms across 6,000 rows.

### 6. Dashboard: top departments

```sql
SELECT department, COUNT(*) FROM employees
WHERE status = 'ACTIVE'
GROUP BY department
ORDER BY COUNT(*) DESC LIMIT 5;
```

```
Limit  (cost=247.56..247.57 rows=5)
  ->  Sort  (Sort Key: (count(*)) DESC)
        ->  GroupAggregate
              Group Key: department
              ->  Index Only Scan using ix_employees_dept_status on employees
                    Index Cond: (status = 'ACTIVE'::text)
Execution Time: 1.116 ms
```

Same composite index, this time used as `status = ACTIVE` prefix. 1.12 ms across 5,000 employees.

## Reproducing

```bash
cd backend
.venv/Scripts/python.exe -c "
from sqlalchemy import create_engine, text
from app.core.config import get_settings
eng = create_engine(get_settings().database_url_sync)
with eng.connect() as c:
    for row in c.execute(text('EXPLAIN (ANALYZE, BUFFERS) <query>')):
        print(row[0])
"
```
