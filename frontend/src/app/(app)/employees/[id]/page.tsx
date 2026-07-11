"use client";

import {
  ArrowLeft,
  Briefcase,
  Building2,
  Mail,
  Pencil,
  Phone,
  Trash2,
  User,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ConfirmButton } from "@/components/confirm";
import { Select } from "@/components/input";
import { Badge, Card } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useProjects } from "@/lib/use-projects";
import type {
  Employee,
  EmployeeStatus,
  Page,
  Project,
  ProjectAssignment,
  Seat,
} from "@/lib/types";

const STATUS_OPTIONS: EmployeeStatus[] = ["active", "on_leave", "exited"];

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin", "hr");

  const [emp, setEmp] = useState<Employee | null>(null);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function remove() {
    if (!emp) return;
    setErr(null);
    try {
      await apiFetch(`/api/v1/employees/${emp.id}`, { method: "DELETE" });
      router.replace("/employees");
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    }
  }

  useEffect(() => {
    apiFetch<Employee>(`/api/v1/employees/${id}`)
      .then(async (e) => {
        setEmp(e);
        if (e.current_seat_id) {
          apiFetch<Seat>(`/api/v1/seats/${e.current_seat_id}`)
            .then(setSeat)
            .catch(() => {});
        }
        if (e.current_project_id) {
          apiFetch<Project>(`/api/v1/projects/${e.current_project_id}`)
            .then(setProject)
            .catch(() => {});
        }
      })
      .catch((e) => setErr(e.message));
  }, [id]);

  if (err)
    return (
      <p className="rounded-md border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
        {err}
      </p>
    );
  if (!emp)
    return <p className="text-sm text-muted-foreground">Loading…</p>;

  const initials =
    `${emp.first_name[0] ?? ""}${emp.last_name[0] ?? ""}`.toUpperCase();

  return (
    <div className="space-y-6">
      <Link
        href="/employees"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to employees
      </Link>

      {/* Header card */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="text-lg font-semibold">{initials}</span>
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {emp.first_name} {emp.last_name}
              </h1>
              <StatusControl
                employee={emp}
                canEdit={canEdit}
                onUpdated={(updated) => setEmp(updated)}
              />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{emp.emp_code}</span> ·{" "}
              {emp.designation} · {emp.department}
            </p>
          </div>
          {canEdit && (
            <ConfirmButton
              label="Delete"
              icon={<Trash2 className="h-3 w-3" />}
              onConfirm={remove}
            />
          )}
        </div>
        {err && (
          <p className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {err}
          </p>
        )}

        <div className="mt-6 grid gap-4 text-sm md:grid-cols-2">
          <InfoRow icon={Mail} label="Email" value={emp.email} />
          <InfoRow icon={Phone} label="Phone" value={emp.phone ?? "—"} />
          <InfoRow icon={Briefcase} label="Designation" value={emp.designation} />
          <InfoRow icon={Building2} label="Department" value={emp.department} />
          <InfoRow icon={User} label="Joined" value={emp.joining_date} />
          <InfoRow
            icon={User}
            label="Exit date"
            value={emp.exit_date ?? "—"}
          />
        </div>
      </Card>

      {/* Seat + project */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <p className="label-cap">Current seat</p>
          {seat ? (
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-mono text-base font-semibold tracking-tight">
                {seat.seat_code}
              </p>
              <p className="text-xs text-muted-foreground">
                {seat.building} · Floor {seat.floor} · Zone {seat.zone}
                {seat.bay ? ` · ${seat.bay}` : ""}
              </p>
              <div>
                <Badge status={seat.status} />
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No seat allocated.
            </p>
          )}
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-2">
            <p className="label-cap">Current project</p>
            {canEdit && (
              <ProjectControl
                employee={emp}
                currentProject={project}
                onChanged={(next) => {
                  setProject(next);
                  setEmp((prev) =>
                    prev
                      ? { ...prev, current_project_id: next?.id ?? null }
                      : prev,
                  );
                }}
              />
            )}
          </div>
          {project ? (
            <div className="mt-3 space-y-2 text-sm">
              <Link
                href={`/projects/${project.id}`}
                className="text-base font-semibold text-primary hover:underline"
              >
                {project.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{project.code}</span> ·{" "}
                {project.client}
              </p>
              <div>
                <Badge status={project.status} />
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No project assigned.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatusControl({
  employee,
  canEdit,
  onUpdated,
}: {
  employee: Employee;
  canEdit: boolean;
  onUpdated: (e: Employee) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nextStatus, setNextStatus] = useState<EmployeeStatus>(employee.status);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (nextStatus === employee.status) {
      setEditing(false);
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const patch: Record<string, unknown> = { status: nextStatus };
      // When marking exited, also record today as the exit_date so the
      // profile shows a real handoff timestamp instead of "—".
      if (nextStatus === "exited" && !employee.exit_date) {
        patch.exit_date = new Date().toISOString().slice(0, 10);
      }
      const updated = await apiFetch<Employee>(
        `/api/v1/employees/${employee.id}`,
        { method: "PATCH", json: patch },
      );
      onUpdated(updated);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return <Badge status={employee.status} />;
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <Badge status={employee.status} />
        <button
          type="button"
          onClick={() => {
            setNextStatus(employee.status);
            setErr(null);
            setEditing(true);
          }}
          title="Change status"
          aria-label="Change status"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={nextStatus}
        onChange={(e) => setNextStatus(e.target.value as EmployeeStatus)}
        aria-label="New status"
        className="h-7 w-32 py-0 text-xs"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </Select>
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={busy}
        className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium transition hover:bg-accent disabled:opacity-50"
      >
        Cancel
      </button>
      {err && (
        <p className="w-full rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-xs text-danger">
          {err}
        </p>
      )}
    </div>
  );
}

function ProjectControl({
  employee,
  currentProject,
  onChanged,
}: {
  employee: Employee;
  currentProject: Project | null;
  onChanged: (next: Project | null) => void;
}) {
  const { projects } = useProjects();
  const [editing, setEditing] = useState(false);
  const [pickedId, setPickedId] = useState<string>(
    currentProject ? String(currentProject.id) : "",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Only ACTIVE projects are valid targets (spec §3.2 says "active").
  const activeProjects = projects.filter((p) => p.status === "active");

  async function findActiveAssignmentId(): Promise<number | null> {
    if (!currentProject) return null;
    // The 1:1 rule means there's at most one active row per employee, so
    // paging through the roster is fine — we take the first match.
    let offset = 0;
    const limit = 200;
    while (true) {
      const p = await apiFetch<Page<ProjectAssignment>>(
        `/api/v1/projects/${currentProject.id}/roster?active_only=true&limit=${limit}&offset=${offset}`,
      );
      const hit = p.items.find((a) => a.employee_id === employee.id);
      if (hit) return hit.id;
      if (offset + limit >= p.total) return null;
      offset += limit;
    }
  }

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      const targetId = pickedId ? Number(pickedId) : null;
      const currentId = currentProject?.id ?? null;
      if (targetId === currentId) {
        setEditing(false);
        return;
      }

      // Close the current active assignment first (if any). This clears
      // employees.current_project_id server-side so the POST that follows
      // doesn't trip the partial-unique 1:1 index.
      if (currentId !== null) {
        const aid = await findActiveAssignmentId();
        if (aid == null) {
          throw new Error(
            "Couldn't find the active assignment row to close — try refreshing.",
          );
        }
        const today = new Date().toISOString().slice(0, 10);
        await apiFetch(
          `/api/v1/projects/${currentId}/assignments/${aid}`,
          { method: "PATCH", json: { end_date: today } },
        );
      }

      // Create a fresh active assignment on the picked project.
      if (targetId !== null) {
        await apiFetch(`/api/v1/projects/${targetId}/assignments`, {
          method: "POST",
          json: {
            employee_id: employee.id,
            project_id: targetId,
            role: "Developer",
            allocation_pct: 100,
            start_date: new Date().toISOString().slice(0, 10),
          },
        });
      }

      const nextProject =
        targetId == null
          ? null
          : projects.find((p) => p.id === targetId) ?? null;
      onChanged(nextProject);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setPickedId(currentProject ? String(currentProject.id) : "");
          setErr(null);
          setEditing(true);
        }}
        title={currentProject ? "Change project" : "Assign project"}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        <Pencil className="h-3 w-3" />
        {currentProject ? "Change" : "Assign"}
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-2">
      <Select
        value={pickedId}
        onChange={(e) => setPickedId(e.target.value)}
        aria-label="Pick a project"
        className="h-8 text-xs"
      >
        <option value="">— Unassign —</option>
        {activeProjects.map((p) => (
          <option key={p.id} value={String(p.id)}>
            {p.code} · {p.name}
          </option>
        ))}
      </Select>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setErr(null);
          }}
          disabled={busy}
          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium transition hover:bg-accent disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {err && (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-xs text-danger">
          {err}
        </p>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="label-cap">{label}</p>
        <p className="mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}
