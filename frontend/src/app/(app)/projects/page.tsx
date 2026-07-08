"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge, Card, TableShell } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type { Page, Project, ProjectStatus } from "@/lib/types";

const STATUSES: (ProjectStatus | "")[] = ["", "active", "on_hold", "completed"];

export default function ProjectsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const [data, setData] = useState<Page<Project> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (q.trim()) p.set("q", q.trim());
    if (status) p.set("status", status);
    return p.toString();
  }, [q, status, offset]);

  useEffect(() => {
    apiFetch<Page<Project>>(`/api/v1/projects?${query}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [query]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="text-xs font-medium">Search</label>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
              }}
              placeholder="name, code, client"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ProjectStatus | "");
                setOffset(0);
              }}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s || "any"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {err && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{err}</p>
      )}

      <TableShell>
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Code</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Client</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Required Seats</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((p) => (
            <tr key={p.id} className="border-t hover:bg-muted/30">
              <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
              <td className="px-3 py-2">{p.name}</td>
              <td className="px-3 py-2 text-muted-foreground">{p.client}</td>
              <td className="px-3 py-2">
                <Badge status={p.status} />
              </td>
              <td className="px-3 py-2 text-right">{p.required_seats}</td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/projects/${p.id}`}
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
            {data.total} projects · showing {data.items.length}
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
