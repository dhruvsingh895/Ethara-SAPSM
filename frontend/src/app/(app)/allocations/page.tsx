"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, TableShell } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Allocation, Page } from "@/lib/types";

export default function AllocationsPage() {
  const { hasRole } = useAuth();
  const canWrite = hasRole("admin", "hr");

  const [empFilter, setEmpFilter] = useState("");
  const [seatFilter, setSeatFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [offset, setOffset] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Page<Allocation> | null>(null);
  const [tick, setTick] = useState(0);
  const limit = 25;

  const query = useMemo(() => {
    const p = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      active_only: String(activeOnly),
    });
    if (empFilter.trim()) p.set("employee_id", empFilter.trim());
    if (seatFilter.trim()) p.set("seat_id", seatFilter.trim());
    return p.toString();
  }, [empFilter, seatFilter, activeOnly, offset]);

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
          <div>
            <label className="text-xs font-medium">Employee id</label>
            <input
              value={empFilter}
              onChange={(e) => {
                setEmpFilter(e.target.value);
                setOffset(0);
              }}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Seat id</label>
            <input
              value={seatFilter}
              onChange={(e) => {
                setSeatFilter(e.target.value);
                setOffset(0);
              }}
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
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{err}</p>
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
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="rounded-md border px-3 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <button
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
