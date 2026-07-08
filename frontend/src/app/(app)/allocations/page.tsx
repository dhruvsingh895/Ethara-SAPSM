"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { Field, Input } from "@/components/input";
import { Pagination } from "@/components/pagination";
import { Card, PageHeader, TableShell } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Allocation, Employee, Page } from "@/lib/types";

export default function AllocationsPage() {
  const { hasRole } = useAuth();
  const canWrite = hasRole("admin", "hr");

  const [empQuery, setEmpQuery] = useState("");
  const [empId, setEmpId] = useState<number | null>(null);
  const [empMatches, setEmpMatches] = useState<Employee[]>([]);
  const [empSearching, setEmpSearching] = useState(false);

  const [seatFilter, setSeatFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [offset, setOffset] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Page<Allocation> | null>(null);
  const [tick, setTick] = useState(0);
  const limit = 25;

  const empQueryId = useId();
  const seatId = useId();

  // Debounced employee name -> id lookup.
  useEffect(() => {
    const q = empQuery.trim();
    if (!q) {
      setEmpMatches([]);
      setEmpId(null);
      return;
    }
    if (/^\d+$/.test(q)) {
      setEmpId(Number(q));
      setEmpMatches([]);
      return;
    }
    setEmpSearching(true);
    const handle = setTimeout(() => {
      apiFetch<Page<Employee>>(
        `/api/v1/employees?limit=8&offset=0&q=${encodeURIComponent(q)}`,
      )
        .then((p) => {
          setEmpMatches(p.items);
          setEmpId(p.items.length === 1 ? p.items[0].id : null);
        })
        .catch(() => setEmpMatches([]))
        .finally(() => setEmpSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [empQuery]);

  const query = useMemo(() => {
    const p = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      active_only: String(activeOnly),
    });
    if (empId != null) p.set("employee_id", String(empId));
    if (seatFilter.trim()) p.set("seat_id", seatFilter.trim());
    return p.toString();
  }, [empId, seatFilter, activeOnly, offset]);

  useEffect(() => {
    apiFetch<Page<Allocation>>(`/api/v1/allocations?${query}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [query, tick]);

  async function release(id: number) {
    setErr(null);
    setBusyId(id);
    try {
      await apiFetch(`/api/v1/allocations/${id}/release`, {
        method: "POST",
        json: {},
      });
      setTick((t) => t + 1);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Allocations"
        description="Active seat allocations with a full history behind them."
      />

      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field
            label="Employee"
            htmlFor={empQueryId}
            className="md:col-span-2"
          >
            <Input
              id={empQueryId}
              value={empQuery}
              onChange={(e) => {
                setEmpQuery(e.target.value);
                setOffset(0);
              }}
              placeholder="name, email, code, or id"
            />
            {empQuery.trim() && (
              <div className="text-xs text-muted-foreground">
                {empSearching && "Searching…"}
                {!empSearching && empMatches.length > 1 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {empMatches.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setEmpId(m.id);
                          setEmpQuery(`${m.emp_code} ${m.first_name} ${m.last_name}`);
                          setEmpMatches([]);
                        }}
                        className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium hover:bg-accent"
                      >
                        {m.emp_code} · {m.first_name} {m.last_name}
                      </button>
                    ))}
                  </div>
                )}
                {!empSearching && empId != null && empMatches.length !== 1 && (
                  <span className="text-primary">
                    → matching employee_id={empId}
                  </span>
                )}
                {!empSearching &&
                  empQuery.trim() &&
                  empMatches.length === 0 &&
                  empId == null && <span>No matches</span>}
              </div>
            )}
          </Field>
          <Field label="Seat id" htmlFor={seatId}>
            <Input
              id={seatId}
              value={seatFilter}
              onChange={(e) => {
                setSeatFilter(e.target.value);
                setOffset(0);
              }}
              placeholder="numeric id"
            />
          </Field>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => {
                  setActiveOnly(e.target.checked);
                  setOffset(0);
                }}
                className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
              />
              Active only
            </label>
          </div>
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
            <Th>#</Th>
            <Th>Seat</Th>
            <Th>Employee</Th>
            <Th>Allocated</Th>
            <Th>Released</Th>
            <Th>Note</Th>
            <Th className="pr-4 text-right">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((a) => (
            <tr
              key={a.id}
              className="border-b border-border/60 last:border-0 transition-colors hover:bg-accent/40"
            >
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                {a.id}
              </td>
              <td className="px-4 py-2.5 tabular-nums">{a.seat_id}</td>
              <td className="px-4 py-2.5 tabular-nums">{a.employee_id}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                {new Date(a.allocated_at).toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                {a.released_at
                  ? new Date(a.released_at).toLocaleString()
                  : "—"}
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                {a.note ?? ""}
              </td>
              <td className="pr-4 py-2.5 text-right">
                {canWrite && a.released_at === null && (
                  <button
                    type="button"
                    disabled={busyId === a.id}
                    onClick={() => release(a.id)}
                    className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium transition hover:bg-accent disabled:opacity-40"
                  >
                    {busyId === a.id ? "…" : "Release"}
                  </button>
                )}
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
          label="allocations"
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
