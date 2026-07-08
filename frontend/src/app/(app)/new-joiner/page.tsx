"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { Badge, Card } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Allocation, Employee, Page, Seat } from "@/lib/types";

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

const DEFAULT_DESIGNATIONS: Record<string, string> = {
  Engineering: "SDE 2",
  Product: "PM",
  Design: "Designer",
  QA: "QA Engineer",
  Data: "Data Engineer",
  Sales: "AE",
  Ops: "Ops Analyst",
  HR: "HRBP",
  Finance: "Finance Analyst",
};

export default function NewJoinerPage() {
  const { hasRole } = useAuth();
  const authorized = hasRole("admin", "hr");

  // Step 1 — create employee
  const [creating, setCreating] = useState(false);
  const [empId, setEmpId] = useState<string>("");
  const [createdEmp, setCreatedEmp] = useState<Employee | null>(null);

  // Step 2 — suggest
  const [department, setDepartment] = useState("Engineering");
  const [projectId, setProjectId] = useState<string>("");
  const [suggestions, setSuggestions] = useState<Seat[]>([]);

  // Step 3 — pick
  const [chosen, setChosen] = useState<Seat | null>(null);

  // Step 4 — allocate
  const [result, setResult] = useState<Allocation | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!authorized) {
    return (
      <p className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200">
        Only HR or Admin can use the new-joiner flow.
      </p>
    );
  }

  async function suggest() {
    setErr(null);
    setResult(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = { department, limit: 8 };
      if (projectId.trim()) body.project_id = Number(projectId);
      const s = await apiFetch<Seat[]>("/api/v1/new-joiner/suggest", {
        method: "POST",
        json: body,
      });
      setSuggestions(s);
      setChosen(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function allocate() {
    if (!chosen || !empId.trim()) return;
    setErr(null);
    setBusy(true);
    try {
      const alloc = await apiFetch<Allocation>("/api/v1/new-joiner/allocate", {
        method: "POST",
        json: {
          employee_id: Number(empId),
          seat_id: chosen.id,
          note: "new joiner",
        },
      });
      setResult(alloc);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              1. Create the joiner (or use an existing employee id)
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Fill the form to create a new record, or just paste an existing
              employee id below to skip.
            </p>
          </div>
          {!creating && !createdEmp && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              + New employee
            </button>
          )}
        </div>

        {creating && !createdEmp && (
          <NewEmployeeForm
            initialDepartment={department}
            onCreated={(emp) => {
              setCreatedEmp(emp);
              setEmpId(String(emp.id));
              setDepartment(emp.department);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        )}

        {createdEmp && (
          <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {createdEmp.first_name} {createdEmp.last_name}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    ({createdEmp.emp_code})
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {createdEmp.designation} · {createdEmp.department} · id ={" "}
                  {createdEmp.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreatedEmp(null);
                  setEmpId("");
                }}
                className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
              >
                Change
              </button>
            </div>
          </div>
        )}

        {!creating && !createdEmp && (
          <div className="mt-3">
            <label className="text-xs font-medium">
              …or use an existing employee id
            </label>
            <input
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              placeholder="e.g. 42"
              className="mt-1 w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        )}
      </Card>

      <Card>
        <p className="text-sm font-medium">2. Find a seat near their team</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <label htmlFor="nj-dept" className="text-xs font-medium">
              Department
            </label>
            <select
              id="nj-dept"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nj-proj" className="text-xs font-medium">
              Project id (optional)
            </label>
            <input
              id="nj-proj"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="e.g. 1"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={suggest}
              disabled={busy}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Working…" : "Suggest seats"}
            </button>
          </div>
        </div>
      </Card>

      {suggestions.length > 0 && (
        <Card>
          <p className="text-sm font-medium">3. Pick one</p>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setChosen(s)}
                className={
                  "rounded-md border p-3 text-left text-sm hover:bg-accent " +
                  (chosen?.id === s.id ? "border-primary ring-2 ring-primary" : "")
                }
              >
                <p className="font-mono text-xs">{s.seat_code}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.building} · F{s.floor} · {s.zone}
                </p>
                <div className="mt-2">
                  <Badge status={s.status} />
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {chosen && (
        <Card>
          <p className="text-sm font-medium">4. Allocate</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="grow">
              <label className="text-xs font-medium">Employee id</label>
              <input
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                placeholder="from step 1 above"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={allocate}
              disabled={busy || !empId.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              Allocate {chosen.seat_code}
            </button>
          </div>
        </Card>
      )}

      {err && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      )}

      {result && (
        <Card>
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Allocation #{result.id} created
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Seat {result.seat_id} → Employee{" "}
            <Link
              href={`/employees/${result.employee_id}`}
              className="text-primary hover:underline"
            >
              {result.employee_id}
            </Link>{" "}
            at {new Date(result.allocated_at).toLocaleString()}
          </p>
        </Card>
      )}
    </div>
  );
}

function NewEmployeeForm({
  initialDepartment,
  onCreated,
  onCancel,
}: {
  initialDepartment: string;
  onCreated: (e: Employee) => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState(initialDepartment);
  const [designation, setDesignation] = useState(
    DEFAULT_DESIGNATIONS[initialDepartment] ?? "SDE 2",
  );
  const [joiningDate, setJoiningDate] = useState(today);
  const [phone, setPhone] = useState("");
  const [empCode, setEmpCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Look up next emp_code hint from the total employee count.
  useEffect(() => {
    apiFetch<Page<Employee>>("/api/v1/employees?limit=1&offset=0")
      .then((p) => setEmpCode(`E${String(p.total + 1).padStart(5, "0")}`))
      .catch(() => setEmpCode("E00001"));
  }, []);

  // Keep designation aligned to department if the user hasn't customized.
  useEffect(() => {
    setDesignation((cur) => {
      const defaults = Object.values(DEFAULT_DESIGNATIONS);
      return defaults.includes(cur)
        ? DEFAULT_DESIGNATIONS[department] ?? cur
        : cur;
    });
  }, [department]);

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
    <form onSubmit={submit} className="mt-3 space-y-3 text-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Emp code" value={empCode} onChange={setEmpCode} />
        <div>
          <label htmlFor="nj-form-dept" className="text-xs font-medium">
            Department
          </label>
          <select
            id="nj-form-dept"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <Field label="First name" value={firstName} onChange={setFirstName} required />
        <Field label="Last name" value={lastName} onChange={setLastName} required />
        <Field label="Email" type="email" value={email} onChange={setEmail} required />
        <Field label="Designation" value={designation} onChange={setDesignation} required />
        <Field
          label="Joining date"
          type="date"
          value={joiningDate}
          onChange={setJoiningDate}
          required
        />
        <Field label="Phone" value={phone} onChange={setPhone} />
      </div>

      {err && (
        <p className="rounded-md bg-red-50 p-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create employee"}
        </button>
      </div>
    </form>
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
