"use client";

import { ChevronRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Field, Input, Select } from "@/components/input";
import { Pagination } from "@/components/pagination";
import { Badge, Card, PageHeader, TableShell } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Page, Project, ProjectStatus } from "@/lib/types";

const STATUSES: (ProjectStatus | "")[] = ["", "active", "on_hold", "completed"];

export default function ProjectsPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const [data, setData] = useState<Page<Project> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [showCreate, setShowCreate] = useState(false);

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
  }, [query, tick]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Browse all projects and their staffing."
        actions={
          isAdmin && !showCreate ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              New project
            </button>
          ) : undefined
        }
      />

      {showCreate && isAdmin && (
        <NewProjectForm
          onCreated={() => {
            setShowCreate(false);
            setTick((t) => t + 1);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

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

function NewProjectForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [requiredSeats, setRequiredSeats] = useState<string>("50");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const seats = parseInt(requiredSeats, 10);
      await apiFetch("/api/v1/projects", {
        method: "POST",
        json: {
          code: code.trim(),
          name: name.trim(),
          client: client.trim(),
          description: description.trim() || null,
          start_date: startDate,
          required_seats: Number.isFinite(seats) ? seats : 0,
        },
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm font-medium">New project</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Code" htmlFor="prj-new-code">
            <Input
              id="prj-new-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="PRJ031"
              required
            />
          </Field>
          <Field label="Name" htmlFor="prj-new-name">
            <Input
              id="prj-new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nova Platform 31"
              required
            />
          </Field>
          <Field label="Client" htmlFor="prj-new-client">
            <Input
              id="prj-new-client"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Aurora Bank"
              required
            />
          </Field>
          <Field label="Required seats" htmlFor="prj-new-seats">
            <Input
              id="prj-new-seats"
              type="number"
              min={0}
              value={requiredSeats}
              onChange={(e) => setRequiredSeats(e.target.value)}
              required
            />
          </Field>
          <Field label="Start date" htmlFor="prj-new-start">
            <Input
              id="prj-new-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Description (optional)"
            htmlFor="prj-new-desc"
            className="md:col-span-2"
          >
            <Input
              id="prj-new-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short blurb"
            />
          </Field>
        </div>

        {err && (
          <p className="rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
            {err}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create project"}
          </button>
        </div>
      </form>
    </Card>
  );
}
