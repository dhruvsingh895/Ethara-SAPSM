"use client";

import { ArrowLeft, Building2, Briefcase, Mail, Phone, User } from "lucide-react";
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
      <p className="rounded-md border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
        {err}
      </p>
    );
  if (!emp)
    return <p className="text-sm text-muted-foreground">Loading…</p>;

  const initials = `${emp.first_name[0] ?? ""}${emp.last_name[0] ?? ""}`.toUpperCase();

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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {emp.first_name} {emp.last_name}
              </h1>
              <Badge status={emp.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{emp.emp_code}</span> ·{" "}
              {emp.designation} · {emp.department}
            </p>
          </div>
        </div>

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
          <p className="label-cap">Current project</p>
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
