"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";

import { Badge, Card, TableShell } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Employee, EmployeeStatus, Page } from "@/lib/types";

const STATUS_OPTIONS: (EmployeeStatus | "")[] = ["", "active", "on_leave", "exited"];

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
  const [status, setStatus] = useState<EmployeeStatus | "">("");
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const [data, setData] = useState<Page<Employee> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

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
  }, [query, refreshTick]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Filters</p>
          {canAdd && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              + Add employee
            </button>
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

      {showAdd && (
        <AddEmployeeDialog
          totalHint={data?.total ?? 0}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            setOffset(0);
            setRefreshTick((t) => t + 1);
          }}
        />
      )}
    </div>
  );
}

function AddEmployeeDialog({
  totalHint,
  onClose,
  onCreated,
}: {
  totalHint: number;
  onClose: () => void;
  onCreated: (emp: Employee) => void;
}) {
  const nextCode = `E${String(totalHint + 1).padStart(5, "0")}`;
  const today = new Date().toISOString().slice(0, 10);

  const [empCode, setEmpCode] = useState(nextCode);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("Engineering");
  const [designation, setDesignation] = useState("SDE 2");
  const [joiningDate, setJoiningDate] = useState(today);
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const created = await apiFetch<Employee>("/api/v1/employees", {
        method: "POST",
        json: {
          emp_code: empCode.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          department,
          designation: designation.trim(),
          joining_date: joiningDate,
          phone: phone.trim() || null,
        },
      });
      onCreated(created);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.detail : String(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-emp-title"
        className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="add-emp-title" className="text-lg font-semibold">
            Add employee
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
          >
            Close
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Emp code" value={empCode} onChange={setEmpCode} />
            <Field label="First name" value={firstName} onChange={setFirstName} required />
            <Field label="Last name" value={lastName} onChange={setLastName} required />
            <Field label="Email" type="email" value={email} onChange={setEmail} required />
            <div>
              <label htmlFor="add-emp-dept" className="text-xs font-medium">
                Department
              </label>
              <select
                id="add-emp-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <Field label="Designation" value={designation} onChange={setDesignation} required />
            <Field label="Joining date" type="date" value={joiningDate} onChange={setJoiningDate} required />
            <Field label="Phone" value={phone} onChange={setPhone} />
          </div>

          {err && (
            <p className="rounded-md bg-red-50 p-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
              {err}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        placeholder={label}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}
