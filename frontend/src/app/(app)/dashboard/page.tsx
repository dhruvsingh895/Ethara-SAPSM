"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, Stat } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type {
  FloorOccupancy,
  Overview,
  ProjectUtilization,
} from "@/lib/types";

const SEAT_COLORS: Record<string, string> = {
  Occupied: "hsl(217, 91%, 60%)",
  Available: "hsl(142, 71%, 45%)",
  Reserved: "hsl(45, 100%, 51%)",
  Blocked: "hsl(0, 84%, 60%)",
};

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [byFloor, setByFloor] = useState<FloorOccupancy[]>([]);
  const [utilization, setUtilization] = useState<ProjectUtilization[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Overview>("/api/v1/dashboard/overview"),
      apiFetch<FloorOccupancy[]>("/api/v1/dashboard/occupancy/by-floor"),
      apiFetch<ProjectUtilization[]>("/api/v1/dashboard/projects/utilization"),
    ])
      .then(([o, f, u]) => {
        setOverview(o);
        setByFloor(f);
        setUtilization(u);
      })
      .catch((e) => setErr(e.message));
  }, []);

  if (err)
    return (
      <p className="rounded-md bg-red-50 p-4 text-sm text-red-800">
        Failed to load dashboard: {err}
      </p>
    );
  if (!overview) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const pieData = [
    { name: "Occupied", value: overview.occupancy.occupied },
    { name: "Available", value: overview.occupancy.available },
    { name: "Reserved", value: overview.occupancy.reserved },
    { name: "Blocked", value: overview.occupancy.blocked },
  ];

  const floorData = byFloor.map((f) => ({
    label: `${f.building} F${f.floor}`,
    occupied: f.occupied,
    available: f.available,
    other: f.total - f.occupied - f.available,
  }));

  const topUtil = [...utilization]
    .sort((a, b) => b.utilization_pct - a.utilization_pct)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat
          label="Occupancy"
          value={`${overview.occupancy.occupancy_pct.toFixed(1)}%`}
          hint={`${overview.occupancy.occupied} of ${overview.occupancy.total_seats} seats`}
        />
        <Stat
          label="Active employees"
          value={overview.active_employees.toLocaleString()}
        />
        <Stat
          label="Joiners in 30 days"
          value={overview.joiners_last_30_days}
        />
        <Stat
          label="Active projects"
          value={overview.active_projects}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="h-80">
          <p className="text-sm font-medium">Seat status</p>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={90}
                paddingAngle={2}
                label={(entry) => `${entry.name}: ${entry.value}`}
              >
                {pieData.map((d) => (
                  <Cell key={d.name} fill={SEAT_COLORS[d.name]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="h-80">
          <p className="text-sm font-medium">Top departments (active headcount)</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart
              data={overview.top_departments}
              layout="vertical"
              margin={{ left: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="department" type="category" width={100} />
              <Tooltip />
              <Bar dataKey="active" fill={SEAT_COLORS.Occupied} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="h-96">
        <p className="text-sm font-medium">Occupancy by floor</p>
        <ResponsiveContainer width="100%" height="92%">
          <BarChart data={floorData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="occupied" stackId="a" fill={SEAT_COLORS.Occupied} />
            <Bar dataKey="available" stackId="a" fill={SEAT_COLORS.Available} />
            <Bar dataKey="other" stackId="a" fill="#d4d4d8" name="reserved/blocked" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <p className="mb-3 text-sm font-medium">Top project utilization</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Code</th>
                <th>Name</th>
                <th className="text-right">Members</th>
                <th className="text-right">Required</th>
                <th className="text-right">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {topUtil.map((u) => (
                <tr key={u.project_id} className="border-t">
                  <td className="py-2 font-mono text-xs">{u.project_code}</td>
                  <td>{u.project_name}</td>
                  <td className="text-right">{u.active_members}</td>
                  <td className="text-right">{u.required_seats}</td>
                  <td
                    className={
                      "text-right font-medium " +
                      (u.utilization_pct > 100
                        ? "text-red-600"
                        : u.utilization_pct < 50
                        ? "text-yellow-600"
                        : "text-green-700")
                    }
                  >
                    {u.utilization_pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
