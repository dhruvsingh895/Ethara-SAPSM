"use client";

import { ChevronRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Field, Input, Select } from "@/components/input";
import { Pagination } from "@/components/pagination";
import { Badge, Card, PageHeader, TableShell } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Employee, EmployeeStatus, Page } from "@/lib/types";

const STATUS_OPTIONS: (EmployeeStatus | "")[] = [
  "",
  "active",
  "on_leave",
  "exited",
];

const DEPARTMENTS = [
  "Engineering",
  "Product",
  "Design",
  "QA",
  "Data",
  "Sales",
  "Ops",
  "HR",
  "Finance",
];

export default function EmployeesPage() {
  const { hasRole } = useAuth();
  const canAdd = hasRole("admin", "hr");

  const [q, setQ] = useState("");
  const [department, setDepartment] = useState("");
  // Default to "active" so the top-line count matches the dashboard
  // (which also filters to active employees). Users can switch to "any"
  // to see the full population including exited.
  const [status, setStatus] = useState<EmployeeStatus | "">("active");
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Search and browse the full workforce."
        actions={
          canAdd && (
            <Link
              href="/new-joiner"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              New joiner
            </Link>
          )
        }
      />

      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="Search" htmlFor="emp-q" className="md:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="emp-q"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOffset(0);
                }}
                placeholder="name, email, code, designation, or department…"
                className="pl-8"
              />
            </div>
          </Field>
          <Field label="Department" htmlFor="emp-dept">
            <Select
              id="emp-dept"
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">Any department</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="emp-status">
            <Select
              id="emp-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as EmployeeStatus | "");
                setOffset(0);
              }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s || "Any status"}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {err && (
        <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {err}
        </p>
      )}

      <TableShell>
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <Th>Code</Th>
            <Th>Name</Th>
            <Th>Department</Th>
            <Th>Designation</Th>
            <Th>Status</Th>
            <Th>Seat</Th>
            <Th className="text-right pr-4">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td
                colSpan={7}
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                Loading…
              </td>
            </tr>
          )}
          {!loading && data && data.items.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                No employees match those filters.
              </td>
            </tr>
          )}
          {data?.items.map((e) => (
            <tr
              key={e.id}
              className="border-b border-border/60 last:border-0 transition-colors hover:bg-accent/40"
            >
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                {e.emp_code}
              </td>
              <td className="px-4 py-2.5 font-medium">
                {e.first_name} {e.last_name}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {e.department}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {e.designation}
              </td>
              <td className="px-4 py-2.5">
                <Badge status={e.status} />
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                {e.current_seat_id ?? "—"}
              </td>
              <td className="pr-4 py-2.5 text-right">
                <Link
                  href={`/employees/${e.id}`}
                  className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                >
                  View
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      {data && (
        <Pagination
          offset={offset}
          limit={limit}
          total={data.total}
          label="employees"
          onChange={setOffset}
        />
      )}
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={
        "px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground " +
        (className ?? "")
      }
    >
      {children}
    </th>
  );
}

