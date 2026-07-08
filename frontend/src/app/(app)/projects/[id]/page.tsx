"use client";

import { ArrowLeft, Building2, Calendar, Trash2, User } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ConfirmButton } from "@/components/confirm";
import { Badge, Card, TableShell } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Page, Project, ProjectAssignment } from "@/lib/types";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [project, setProject] = useState<Project | null>(null);
  const [roster, setRoster] = useState<ProjectAssignment[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function remove() {
    if (!project) return;
    setErr(null);
    try {
      await apiFetch(`/api/v1/projects/${project.id}`, { method: "DELETE" });
      router.replace("/projects");
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    }
  }

  useEffect(() => {
    Promise.all([
      apiFetch<Project>(`/api/v1/projects/${id}`),
      apiFetch<Page<ProjectAssignment>>(
        `/api/v1/projects/${id}/roster?limit=100&active_only=true`,
      ),
    ])
      .then(([p, r]) => {
        setProject(p);
        setRoster(r.items);
      })
      .catch((e) => setErr(e.message));
  }, [id]);

  if (err)
    return (
      <p className="rounded-md border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
        {err}
      </p>
    );
  if (!project)
    return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </Link>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {project.name}
              </h1>
              <Badge status={project.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{project.code}</span> ·{" "}
              {project.client}
            </p>
          </div>
          {isAdmin && (
            <ConfirmButton
              label="Delete"
              icon={<Trash2 className="h-3 w-3" />}
              onConfirm={remove}
            />
          )}
        </div>

        <div className="mt-6 grid gap-4 text-sm md:grid-cols-4">
          <InfoRow icon={Building2} label="Client" value={project.client} />
          <InfoRow
            icon={User}
            label="Required seats"
            value={project.required_seats}
          />
          <InfoRow icon={Calendar} label="Start" value={project.start_date} />
          <InfoRow
            icon={Calendar}
            label="End"
            value={project.end_date ?? "—"}
          />
        </div>

        {project.description && (
          <div className="divider mt-6 pt-4">
            <p className="label-cap">Description</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {project.description}
            </p>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Active roster</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Currently assigned members
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {roster.length} member{roster.length === 1 ? "" : "s"}
          </p>
        </div>
        <TableShell>
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <Th>Employee</Th>
              <Th>Role</Th>
              <Th className="text-right">Allocation</Th>
              <Th>Start</Th>
              <Th>End</Th>
            </tr>
          </thead>
          <tbody>
            {roster.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No active assignments.
                </td>
              </tr>
            )}
            {roster.map((a) => (
              <tr
                key={a.id}
                className="border-b border-border/60 last:border-0 transition-colors hover:bg-accent/40"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/employees/${a.employee_id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    #{a.employee_id}
                  </Link>
                </td>
                <td className="px-4 py-2.5">{a.role}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {a.allocation_pct}%
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {a.start_date}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {a.end_date ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Card>
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
        <p className="mt-0.5 truncate text-sm">{value}</p>
      </div>
    </div>
  );
}
