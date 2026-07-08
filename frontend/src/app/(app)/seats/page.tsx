"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Field, Select } from "@/components/input";
import { Badge, Card, PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  Allocation,
  Employee,
  Page,
  Seat,
  SeatStatusValue,
} from "@/lib/types";

const BUILDINGS = ["B1", "B2", "B3"];
const FLOORS = [1, 2, 3, 4, 5];
const STATUS_OPTIONS: (SeatStatusValue | "")[] = [
  "",
  "available",
  "occupied",
  "reserved",
  "blocked",
];

const SEAT_CLS: Record<SeatStatusValue, string> = {
  available:
    "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25 dark:text-emerald-300",
  occupied:
    "bg-indigo-500/15 text-indigo-700 ring-1 ring-indigo-500/30 hover:bg-indigo-500/25 dark:text-indigo-300",
  reserved:
    "bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 hover:bg-amber-500/25 dark:text-amber-300",
  blocked:
    "bg-rose-500/15 text-rose-700 ring-1 ring-rose-500/30 hover:bg-rose-500/25 dark:text-rose-300",
};

const LEGEND: { status: SeatStatusValue; label: string; dot: string }[] = [
  { status: "available", label: "Available", dot: "bg-emerald-500" },
  { status: "occupied", label: "Occupied", dot: "bg-indigo-500" },
  { status: "reserved", label: "Reserved", dot: "bg-amber-500" },
  { status: "blocked", label: "Blocked", dot: "bg-rose-500" },
];

export default function SeatsPage() {
  const [building, setBuilding] = useState("B1");
  const [floor, setFloor] = useState(1);
  const [status, setStatus] = useState<SeatStatusValue | "">("");
  const [data, setData] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Seat | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams({
      limit: "200",
      offset: "0",
      building,
      floor: String(floor),
    });
    if (status) p.set("status", status);
    return p.toString();
  }, [building, floor, status]);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    apiFetch<Page<Seat>>(`/api/v1/seats?${query}`)
      .then((p) => setData(p.items))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [query]);

  const byZone = useMemo(() => {
    const groups: Record<string, Seat[]> = {};
    for (const s of data) {
      groups[s.zone] = groups[s.zone] || [];
      groups[s.zone].push(s);
    }
    for (const z of Object.keys(groups)) {
      groups[z].sort((a, b) => a.seat_number - b.seat_number);
    }
    return groups;
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seats"
        description="Interactive floor plan. Click any seat to see its details."
      />

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Building" htmlFor="seat-building">
            <Select
              id="seat-building"
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              className="w-28"
            >
              {BUILDINGS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Floor" htmlFor="seat-floor">
            <Select
              id="seat-floor"
              value={floor}
              onChange={(e) => setFloor(Number(e.target.value))}
              className="w-28"
            >
              {FLOORS.map((f) => (
                <option key={f} value={f}>
                  F{f}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="seat-status">
            <Select
              id="seat-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as SeatStatusValue | "")}
              className="w-36"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s || "Any status"}
                </option>
              ))}
            </Select>
          </Field>

          <div className="ml-auto flex flex-wrap items-center gap-3 text-xs">
            {LEGEND.map((l) => (
              <span
                key={l.status}
                className="inline-flex items-center gap-1.5 text-muted-foreground"
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", l.dot)} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </Card>

      {err && (
        <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {err}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {building} · Floor {floor}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {loading ? "Loading…" : `${data.length} seats`}
              </p>
            </div>
          </div>
          <div className="space-y-5">
            {Object.keys(byZone)
              .sort()
              .map((zone) => (
                <div key={zone}>
                  <p className="label-cap mb-2">Zone {zone}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {byZone[zone].map((seat) => (
                      <button
                        key={seat.id}
                        type="button"
                        onClick={() => setSelected(seat)}
                        title={`${seat.seat_code} — ${seat.status}`}
                        className={cn(
                          "flex h-8 w-9 items-center justify-center rounded-md text-[10px] font-mono font-medium transition",
                          SEAT_CLS[seat.status],
                          selected?.id === seat.id
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : "",
                        )}
                      >
                        {seat.seat_number}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            {!loading && data.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No seats match those filters.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <p className="label-cap">Selection</p>
          {selected ? <SelectionPanel seat={selected} /> : (
            <p className="mt-3 text-sm text-muted-foreground">
              Click a seat to inspect it.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function SelectionPanel({ seat }: { seat: Seat }) {
  const [occupant, setOccupant] = useState<Employee | null>(null);
  const [allocatedAt, setAllocatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setOccupant(null);
    setAllocatedAt(null);
    setNotFound(false);
    if (seat.status !== "occupied") return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const allocs = await apiFetch<Page<Allocation>>(
          `/api/v1/allocations?seat_id=${seat.id}&active_only=true&limit=1`,
        );
        if (cancelled) return;
        const active = allocs.items[0];
        if (!active) {
          setNotFound(true);
          return;
        }
        setAllocatedAt(active.allocated_at);
        const emp = await apiFetch<Employee>(
          `/api/v1/employees/${active.employee_id}`,
        );
        if (!cancelled) setOccupant(emp);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [seat.id, seat.status]);

  return (
    <div className="mt-3 space-y-3 text-sm">
      <div>
        <p className="font-mono text-base font-semibold tracking-tight">
          {seat.seat_code}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {seat.building} · Floor {seat.floor} · Zone {seat.zone}
        </p>
      </div>
      <Badge status={seat.status} />
      {seat.notes && (
        <p className="text-xs text-muted-foreground">{seat.notes}</p>
      )}

      {seat.status === "occupied" && (
        <div className="divider pt-3">
          <p className="label-cap">Occupant</p>
          {loading && (
            <p className="mt-2 text-xs text-muted-foreground">Looking up…</p>
          )}
          {!loading && occupant && (
            <div className="mt-2 space-y-1">
              <Link
                href={`/employees/${occupant.id}`}
                className="text-sm font-semibold text-primary hover:underline"
              >
                {occupant.first_name} {occupant.last_name}
              </Link>
              <p className="font-mono text-xs text-muted-foreground">
                {occupant.emp_code}
              </p>
              <p className="text-xs text-muted-foreground">
                {occupant.designation} · {occupant.department}
              </p>
              {allocatedAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Since {new Date(allocatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
          {!loading && !occupant && notFound && (
            <p className="mt-2 text-xs text-muted-foreground">
              No active allocation found for this seat.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
