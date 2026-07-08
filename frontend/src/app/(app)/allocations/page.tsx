"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { Card, TableShell } from "@/components/ui";
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
    // If the user typed a pure number, treat it as the id directly.
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
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor={empQueryId} className="text-xs font-medium">
              Employee (name, email, emp_code, or id)
            </label>
            <input
              id={empQueryId}
              value={empQuery}
              onChange={(e) => {
                setEmpQuery(e.target.value);
                setOffset(0);
              }}
              placeholder="e.g. Ankit or E00042 or 42"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            {empQuery.trim() && (
              <div className="mt-1 text-xs text-muted-foreground">
                {empSearching && "searching…"}
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
                        className="rounded-full border bg-background px-2 py-0.5 text-[11px] hover:bg-accent"
                      >
                        {m.emp_code} · {m.first_name} {m.last_name}
                      </button>
                    ))}
                  </div>
                )}
                {!empSearching && empId != null && (
                  <span className="text-primary">→ employee_id={empId}</span>
                )}
                {!empSearching && empQuery.trim() && empMatches.length === 0 && empId == null && (
                  <span>no matches</span>
                )}
              </div>
            )}
          </div>
          <div>
            <label htmlFor={seatId} className="text-xs font-medium">
              Seat id
            </label>
            <input
              id={seatId}
              value={seatFilter}
              onChange={(e) => {
                setSeatFilter(e.target.value);
                setOffset(0);
              }}
              placeholder="numeric id"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => {
                  setActiveOnly(e.target.checked);
                  setOffset(0);
                }}
              />
              Active only
            </label>
          </div>
        </div>
      </Card>

      {err && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      )}

      <TableShell>
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Seat</th>
            <th className="px-3 py-2">Employee</th>
            <th className="px-3 py-2">Allocated</th>
            <th className="px-3 py-2">Released</th>
            <th className="px-3 py-2">Note</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="px-3 py-2 font-mono text-xs">{a.id}</td>
              <td className="px-3 py-2">{a.seat_id}</td>
              <td className="px-3 py-2">{a.employee_id}</td>
              <td className="px-3 py-2 text-xs">
                {new Date(a.allocated_at).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-xs">
                {a.released_at
                  ? new Date(a.released_at).toLocaleString()
                  : "—"}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {a.note ?? ""}
              </td>
              <td className="px-3 py-2 text-right">
                {canWrite && a.released_at === null && (
                  <button
                    type="button"
                    disabled={busyId === a.id}
                    onClick={() => release(a.id)}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
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
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {data.total.toLocaleString()} rows · showing {data.items.length}
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
