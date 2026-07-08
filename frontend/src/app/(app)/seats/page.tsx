"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge, Card } from "@/components/ui";
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
    "bg-green-200 text-green-950 hover:bg-green-300 dark:bg-green-700 dark:text-white dark:hover:bg-green-600",
  occupied:
    "bg-blue-200 text-blue-950 hover:bg-blue-300 dark:bg-blue-700 dark:text-white dark:hover:bg-blue-600",
  reserved:
    "bg-yellow-200 text-yellow-950 hover:bg-yellow-300 dark:bg-yellow-600 dark:text-white dark:hover:bg-yellow-500",
  blocked:
    "bg-red-200 text-red-950 hover:bg-red-300 dark:bg-red-700 dark:text-white dark:hover:bg-red-600",
};

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
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="seat-building" className="text-xs font-medium">
              Building
            </label>
            <select
              id="seat-building"
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              className="ml-2 rounded-md border bg-background px-3 py-2 text-sm"
            >
              {BUILDINGS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="seat-floor" className="text-xs font-medium">
              Floor
            </label>
            <select
              id="seat-floor"
              value={floor}
              onChange={(e) => setFloor(Number(e.target.value))}
              className="ml-2 rounded-md border bg-background px-3 py-2 text-sm"
            >
              {FLOORS.map((f) => (
                <option key={f} value={f}>
                  F{f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="seat-status" className="text-xs font-medium">
              Status
            </label>
            <select
              id="seat-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as SeatStatusValue | "")}
              className="ml-2 rounded-md border bg-background px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s || "any"}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto flex gap-3 text-xs">
            <LegendDot label="available" cls="bg-green-200 dark:bg-green-700" />
            <LegendDot label="occupied" cls="bg-blue-200 dark:bg-blue-700" />
            <LegendDot label="reserved" cls="bg-yellow-200 dark:bg-yellow-600" />
            <LegendDot label="blocked" cls="bg-red-200 dark:bg-red-700" />
          </div>
        </div>
      </Card>

      {err && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{err}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">
              {building} · Floor {floor}
            </p>
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading…" : `${data.length} seats`}
            </p>
          </div>
          <div className="space-y-4">
            {Object.keys(byZone)
              .sort()
              .map((zone) => (
                <div key={zone}>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Zone {zone}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {byZone[zone].map((seat) => (
                      <button
                        key={seat.id}
                        type="button"
                        onClick={() => setSelected(seat)}
                        title={`${seat.seat_code} — ${seat.status}`}
                        className={cn(
                          "h-7 w-8 rounded text-[10px] font-mono",
                          SEAT_CLS[seat.status],
                          selected?.id === seat.id
                            ? "ring-2 ring-primary ring-offset-1"
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
              <p className="py-8 text-center text-sm text-muted-foreground">
                No seats match those filters.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <p className="text-sm font-medium">Selection</p>
          {selected ? <SelectionPanel seat={selected} /> : (
            <p className="mt-2 text-sm text-muted-foreground">
              Click a seat to inspect it.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function LegendDot({ label, cls }: { label: string; cls: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className={cn("h-3 w-3 rounded", cls)} />
      {label}
    </span>
  );
}

function SelectionPanel({ seat }: { seat: Seat }) {
  const [occupant, setOccupant] = useState<Employee | null>(null);
  const [allocatedAt, setAllocatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // Reset for the new seat.
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
    <div className="mt-2 space-y-2 text-sm">
      <p className="font-mono">{seat.seat_code}</p>
      <p className="text-xs text-muted-foreground">
        {seat.building} · Floor {seat.floor} · Zone {seat.zone}
      </p>
      <Badge status={seat.status} />
      {seat.notes && (
        <p className="mt-2 text-xs text-muted-foreground">{seat.notes}</p>
      )}

      {seat.status === "occupied" && (
        <div className="mt-3 border-t pt-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Occupant
          </p>
          {loading && (
            <p className="mt-1 text-xs text-muted-foreground">Looking up…</p>
          )}
          {!loading && occupant && (
            <div className="mt-1 space-y-1">
              <Link
                href={`/employees/${occupant.id}`}
                className="font-medium text-primary hover:underline"
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
                <p className="text-xs text-muted-foreground">
                  Sitting here since {new Date(allocatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
          {!loading && !occupant && notFound && (
            <p className="mt-1 text-xs text-muted-foreground">
              No active allocation found for this seat.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
