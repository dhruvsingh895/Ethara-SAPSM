"use client";

import { CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { Field, Input, Select } from "@/components/input";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useDepartments } from "@/lib/use-departments";
import { cn } from "@/lib/utils";
import type {
  Allocation,
  Employee,
  Page,
  Project,
  Seat,
} from "@/lib/types";

/**
 * Turn whatever the user typed (raw numeric id or emp_code like E00042)
 * into an employee.id the backend expects.
 * Returns null if nothing matches.
 */
async function resolveEmployeeId(input: string): Promise<number | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Pure digits -> treat as id
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  // Otherwise look up by q; require an exact emp_code match
  const upper = trimmed.toUpperCase();
  const res = await apiFetch<Page<Employee>>(
    `/api/v1/employees?limit=10&q=${encodeURIComponent(trimmed)}`,
  );
  const exact = res.items.find((e) => e.emp_code.toUpperCase() === upper);
  return exact ? exact.id : null;
}

/**
 * Same idea for a project: numeric id or a code like PRJ001 -> project.id.
 */
async function resolveProjectId(input: string): Promise<number | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const upper = trimmed.toUpperCase();
  const res = await apiFetch<Page<Project>>(
    `/api/v1/projects?limit=10&q=${encodeURIComponent(trimmed)}`,
  );
  const exact = res.items.find((p) => p.code.toUpperCase() === upper);
  return exact ? exact.id : null;
}

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
  const { departments } = useDepartments();

  const [creating, setCreating] = useState(false);
  const [empId, setEmpId] = useState<string>("");
  const [createdEmp, setCreatedEmp] = useState<Employee | null>(null);

  const [department, setDepartment] = useState("Engineering");
  const [projectId, setProjectId] = useState<string>("");
  const [suggestions, setSuggestions] = useState<Seat[]>([]);

  const [chosen, setChosen] = useState<Seat | null>(null);
  const [result, setResult] = useState<Allocation | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!authorized) {
    return (
      <p className="rounded-md border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
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
      if (projectId.trim()) {
        const resolved = await resolveProjectId(projectId.trim());
        if (resolved == null) {
          setErr(
            `No project matches "${projectId.trim()}". Enter a numeric id or a project code like PRJ001.`,
          );
          setBusy(false);
          return;
        }
        body.project_id = resolved;
      }
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
      const resolvedId = await resolveEmployeeId(empId.trim());
      if (resolvedId == null) {
        setErr(
          `No employee matches "${empId.trim()}". Enter a numeric id or a full emp_code like E00042.`,
        );
        setBusy(false);
        return;
      }
      const body: Record<string, unknown> = {
        employee_id: resolvedId,
        seat_id: chosen.id,
        note: "new joiner",
      };
      // Spec §3.2: map the joiner to the picked project in the same
      // call so nobody ends up seated but unassigned.
      if (projectId.trim()) {
        const resolvedProj = await resolveProjectId(projectId.trim());
        if (resolvedProj == null) {
          setErr(
            `No project matches "${projectId.trim()}". Enter a numeric id or a project code like PRJ001.`,
          );
          setBusy(false);
          return;
        }
        body.project_id = resolvedProj;
      }
      const alloc = await apiFetch<Allocation>("/api/v1/new-joiner/allocate", {
        method: "POST",
        json: body,
      });
      setResult(alloc);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New joiner"
        description="Create the employee, pick a seat near their team, and allocate — in a single flow."
      />

      {/* Step 1 — create or use existing */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-cap">Step 1</p>
            <p className="mt-1 text-sm font-medium">Add the joiner</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Create a new employee record, or paste an existing employee id
              to skip ahead.
            </p>
          </div>
          {!creating && !createdEmp && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" />
              New employee
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
          <div className="mt-4 rounded-lg border border-success/40 bg-success/10 p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {createdEmp.first_name} {createdEmp.last_name}
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {createdEmp.emp_code}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
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
                className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium transition hover:bg-accent"
              >
                Change
              </button>
            </div>
          </div>
        )}

        {!creating && !createdEmp && (
          <div className="mt-4">
            <Field
              label="Or use an existing employee (id or emp_code)"
              htmlFor="nj-emp-id"
            >
              <Input
                id="nj-emp-id"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                placeholder="42 or E00042"
                className="max-w-xs"
              />
            </Field>
          </div>
        )}
      </Card>

      {/* Step 2 — suggest */}
      <Card>
        <p className="label-cap">Step 2</p>
        <p className="mt-1 text-sm font-medium">Find a seat near their team</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Department" htmlFor="nj-dept">
            <Select
              id="nj-dept"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Project to map (id or code)"
            htmlFor="nj-proj"
          >
            <Input
              id="nj-proj"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="1 or PRJ001"
            />
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              onClick={suggest}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {busy ? "Working…" : "Suggest seats"}
            </button>
          </div>
        </div>
      </Card>

      {/* Step 3 — pick */}
      {suggestions.length > 0 && (
        <Card>
          <p className="label-cap">Step 3</p>
          <p className="mt-1 text-sm font-medium">Pick one</p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setChosen(s)}
                className={cn(
                  "rounded-lg border p-3 text-left transition",
                  chosen?.id === s.id
                    ? "border-primary bg-primary/5 ring-2 ring-primary/50"
                    : "border-border hover:border-primary/50 hover:bg-accent",
                )}
              >
                <p className="font-mono text-xs font-medium">{s.seat_code}</p>
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

      {/* Step 4 — allocate */}
      {chosen && (
        <Card>
          <p className="label-cap">Step 4</p>
          <p className="mt-1 text-sm font-medium">Allocate</p>
          {!projectId.trim() && (
            <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
              No project picked in Step 2. The joiner will get a seat but
              will remain unmapped to any project — spec §3.2 wants every
              employee mapped to one. Go back and fill in the Project
              field to have it assigned in the same call.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Field
              label="Employee (id or emp_code)"
              htmlFor="nj-allocate-emp"
              className="flex-1 min-w-[200px]"
            >
              <Input
                id="nj-allocate-emp"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                placeholder="42 or E00042 — from step 1 above"
              />
            </Field>
            <button
              type="button"
              onClick={allocate}
              disabled={busy || !empId.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              Allocate {chosen.seat_code}
              {projectId.trim() ? " + assign project" : ""}
            </button>
          </div>
        </Card>
      )}

      {err && (
        <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {err}
        </p>
      )}

      {result && (
        <Card className="border-success/40 bg-success/10">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-success">
                Allocation #{result.id} created
                {projectId.trim() ? " + project assigned" : ""}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Seat {result.seat_id} → Employee{" "}
                <Link
                  href={`/employees/${result.employee_id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {result.employee_id}
                </Link>{" "}
                at {new Date(result.allocated_at).toLocaleString()}
              </p>
            </div>
          </div>
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
  const { departments } = useDepartments();

  useEffect(() => {
    apiFetch<Page<Employee>>("/api/v1/employees?limit=1&offset=0")
      .then((p) => setEmpCode(`E${String(p.total + 1).padStart(5, "0")}`))
      .catch(() => setEmpCode("E00001"));
  }, []);

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
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Employee code" value={empCode} onChange={setEmpCode} />
        <Field label="Department" htmlFor="nj-form-dept">
          <Select
            id="nj-form-dept"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <FormField label="First name" value={firstName} onChange={setFirstName} required />
        <FormField label="Last name" value={lastName} onChange={setLastName} required />
        <FormField label="Email" type="email" value={email} onChange={setEmail} required />
        <FormField label="Designation" value={designation} onChange={setDesignation} required />
        <FormField
          label="Joining date"
          type="date"
          value={joiningDate}
          onChange={setJoiningDate}
          required
        />
        <FormField label="Phone" value={phone} onChange={setPhone} />
      </div>

      {err && (
        <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {err}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create employee"}
        </button>
      </div>
    </form>
  );
}

function FormField({
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
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        placeholder={label}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
