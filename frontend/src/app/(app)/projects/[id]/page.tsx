"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge, Card, TableShell } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type { Page, Project, ProjectAssignment } from "@/lib/types";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [roster, setRoster] = useState<ProjectAssignment[]>([]);
  const [err, setErr] = useState<string | null>(null);

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
      <p className="rounded-md bg-red-50 p-4 text-sm text-red-800">{err}</p>
    );
  if (!project)
    return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <Link
        href="/projects"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Back to projects
      </Link>

      <Card>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">{project.name}</h1>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {project.code}
            </p>
          </div>
          <Badge status={project.status} />
        </div>
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
          <Field label="Client" value={project.client} />
          <Field label="Required seats" value={project.required_seats} />
          <Field label="Start" value={project.start_date} />
          <Field label="End" value={project.end_date ?? "—"} />
          {project.description && (
            <div className="md:col-span-2">
              <Field label="Description" value={project.description} />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Active roster</p>
          <p className="text-xs text-muted-foreground">
            {roster.length} member{roster.length === 1 ? "" : "s"}
          </p>
        </div>
        <TableShell>
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2 text-right">Allocation</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">End</th>
            </tr>
          </thead>
          <tbody>
            {roster.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No active assignments.
                </td>
              </tr>
            )}
            {roster.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2">
                  <Link
                    href={`/employees/${a.employee_id}`}
                    className="text-primary hover:underline"
                  >
                    #{a.employee_id}
                  </Link>
                </td>
                <td className="px-3 py-2">{a.role}</td>
                <td className="px-3 py-2 text-right">{a.allocation_pct}%</td>
                <td className="px-3 py-2">{a.start_date}</td>
                <td className="px-3 py-2">{a.end_date ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Card>
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
