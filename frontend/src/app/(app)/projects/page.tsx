"use client";

import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Field, Input, Select } from "@/components/input";
import { Pagination } from "@/components/pagination";
import { Badge, Card, PageHeader, TableShell } from "@/components/ui";
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
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Browse all projects and their staffing."
      />

      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Search" htmlFor="prj-q" className="md:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="prj-q"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOffset(0);
                }}
                placeholder="name, code, or client…"
                className="pl-8"
              />
            </div>
          </Field>
          <Field label="Status" htmlFor="prj-status">
            <Select
              id="prj-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ProjectStatus | "");
                setOffset(0);
              }}
            >
              {STATUSES.map((s) => (
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
            <Th>Client</Th>
            <Th>Status</Th>
            <Th className="text-right">Required</Th>
            <Th className="text-right pr-4">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((p) => (
            <tr
              key={p.id}
              className="border-b border-border/60 last:border-0 transition-colors hover:bg-accent/40"
            >
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                {p.code}
              </td>
              <td className="px-4 py-2.5 font-medium">{p.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{p.client}</td>
              <td className="px-4 py-2.5">
                <Badge status={p.status} />
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {p.required_seats}
              </td>
              <td className="pr-4 py-2.5 text-right">
                <Link
                  href={`/projects/${p.id}`}
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
          label="projects"
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
