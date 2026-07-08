"use client";

import { useState } from "react";

import { Badge, Card } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Allocation, Seat } from "@/lib/types";

const DEPARTMENTS = [
  "Engineering",
  "Product",
  "Design",
  "QA",
  "Data",
  "Sales",
  "Ops",
  "HR",
  "Finance",
];

export default function NewJoinerPage() {
  const { hasRole } = useAuth();
  const authorized = hasRole("admin", "hr");

  const [department, setDepartment] = useState("Engineering");
  const [projectId, setProjectId] = useState<string>("");
  const [suggestions, setSuggestions] = useState<Seat[]>([]);
  const [empId, setEmpId] = useState<string>("");
  const [chosen, setChosen] = useState<Seat | null>(null);
  const [result, setResult] = useState<Allocation | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!authorized) {
    return (
      <p className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200">
        Only HR or Admin can use the new-joiner flow.
      </p>
    );
  }

  async function suggest() {
    setErr(null);
    setResult(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = { department, limit: 8 };
      if (projectId.trim()) body.project_id = Number(projectId);
      const s = await apiFetch<Seat[]>("/api/v1/new-joiner/suggest", {
        method: "POST",
        json: body,
      });
      setSuggestions(s);
      setChosen(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function allocate() {
    if (!chosen || !empId.trim()) return;
    setErr(null);
    setBusy(true);
    try {
      const alloc = await apiFetch<Allocation>("/api/v1/new-joiner/allocate", {
        method: "POST",
        json: {
          employee_id: Number(empId),
          seat_id: chosen.id,
          note: "new joiner",
        },
      });
      setResult(alloc);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm font-medium">1. Find a seat near their team</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Project id (optional)</label>
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="e.g. 1"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={suggest}
              disabled={busy}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Working…" : "Suggest seats"}
            </button>
          </div>
        </div>
      </Card>

      {suggestions.length > 0 && (
        <Card>
          <p className="text-sm font-medium">2. Pick one</p>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setChosen(s)}
                className={
                  "rounded-md border p-3 text-left text-sm hover:bg-accent " +
                  (chosen?.id === s.id ? "border-primary ring-2 ring-primary" : "")
                }
              >
                <p className="font-mono text-xs">{s.seat_code}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.building} · F{s.floor} · {s.zone}
                </p>
                <div className="mt-2">
                  <Badge status={s.status} />
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {chosen && (
        <Card>
          <p className="text-sm font-medium">3. Allocate to a joiner</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="grow">
              <label className="text-xs font-medium">Employee id</label>
              <input
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                placeholder="numeric id from the employees page"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={allocate}
              disabled={busy || !empId.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              Allocate {chosen.seat_code}
            </button>
          </div>
        </Card>
      )}

      {err && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{err}</p>
      )}

      {result && (
        <Card>
          <p className="text-sm font-medium text-green-700">
            Allocation #{result.id} created
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Seat {result.seat_id} → Employee {result.employee_id} at{" "}
            {new Date(result.allocated_at).toLocaleString()}
          </p>
        </Card>
      )}
    </div>
  );
}
