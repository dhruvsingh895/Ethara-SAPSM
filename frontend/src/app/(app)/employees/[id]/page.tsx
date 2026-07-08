"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type { Employee, Project, Seat } from "@/lib/types";

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
      <p className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{err}</p>
    );
  if (!emp) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <Link
        href="/employees"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Back to employees
      </Link>

      <Card>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              {emp.first_name} {emp.last_name}
            </h1>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {emp.emp_code}
            </p>
          </div>
          <Badge status={emp.status} />
        </div>

        <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
          <Field label="Email" value={emp.email} />
          <Field label="Phone" value={emp.phone ?? "—"} />
          <Field label="Department" value={emp.department} />
          <Field label="Designation" value={emp.designation} />
          <Field label="Joined" value={emp.joining_date} />
          <Field label="Exit date" value={emp.exit_date ?? "—"} />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <p className="text-sm font-medium">Current seat</p>
          {seat ? (
            <div className="mt-2 space-y-1 text-sm">
              <p className="font-mono">{seat.seat_code}</p>
              <p className="text-xs text-muted-foreground">
                {seat.building} · Floor {seat.floor} · Zone {seat.zone}
              </p>
              <Badge status={seat.status} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No seat allocated.
            </p>
          )}
        </Card>

        <Card>
          <p className="text-sm font-medium">Current project</p>
          {project ? (
            <div className="mt-2 space-y-1 text-sm">
              <Link
                href={`/projects/${project.id}`}
                className="font-medium text-primary hover:underline"
              >
                {project.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                Client: {project.client} · Code: {project.code}
              </p>
              <Badge status={project.status} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No project assigned.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}
