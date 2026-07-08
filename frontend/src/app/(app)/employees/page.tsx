"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge, Card, TableShell } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Employee, EmployeeStatus, Page } from "@/lib/types";

const STATUS_OPTIONS: (EmployeeStatus | "")[] = ["", "active", "on_leave", "exited"];

export default function EmployeesPage() {
  const { hasRole } = useAuth();
  const canAdd = hasRole("admin", "hr");

  const [q, setQ] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState<EmployeeStatus | "">("");
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const [data, setData] = useState<Page<Employee> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (q.trim()) p.set("q", q.trim());
    if (department.trim()) p.set("department", department.trim());
    if (status) p.set("status", status);
    return p.toString();
  }, [q, department, status, offset]);

  useEffect(() => {
    setLoading(true);
    apiFetch<Page<Employee>>(`/api/v1/employees?${query}`)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [query]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Filters</p>
          {canAdd && (
            <Link
              href="/new-joiner"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              + New joiner
            </Link>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="emp-q" className="text-xs font-medium">
              Search
            </label>
            <input
              id="emp-q"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
              }}
              placeholder="name, email, emp_code"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="emp-dept" className="text-xs font-medium">
              Department
            </label>
            <input
              id="emp-dept"
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setOffset(0);
              }}
              placeholder="Engineering"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="emp-status" className="text-xs font-medium">
              Status
            </label>
            <select
              id="emp-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as EmployeeStatus | "");
                setOffset(0);
              }}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s || "any"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {err && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      )}

      <TableShell>
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Emp Code</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Department</th>
            <th className="px-3 py-2">Designation</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Seat</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                Loading…
              </td>
            </tr>
          )}
          {!loading && data && data.items.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                No employees match those filters.
              </td>
            </tr>
          )}
          {data?.items.map((e) => (
            <tr key={e.id} className="border-t hover:bg-muted/30">
              <td className="px-3 py-2 font-mono text-xs">{e.emp_code}</td>
              <td className="px-3 py-2">
                {e.first_name} {e.last_name}
              </td>
              <td className="px-3 py-2">{e.department}</td>
              <td className="px-3 py-2 text-muted-foreground">{e.designation}</td>
              <td className="px-3 py-2">
                <Badge status={e.status} />
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {e.current_seat_id ?? "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/employees/${e.id}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      {data && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {data.total.toLocaleString()} employees · page {currentPage} of{" "}
            {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="rounded-md border px-3 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={offset + limit >= data.total}
              onClick={() => setOffset(offset + limit)}
              className="rounded-md border px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
