"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { ConfirmButton } from "@/components/confirm";
import { Field, Input } from "@/components/input";
import { Card, PageHeader, TableShell } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Department } from "@/lib/types";

export default function DepartmentsPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [tick, setTick] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<Department[]>("/api/v1/departments")
      .then(setItems)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [tick]);

  async function remove(d: Department) {
    setErr(null);
    try {
      await apiFetch(`/api/v1/departments/${d.id}`, { method: "DELETE" });
      setTick((t) => t + 1);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="The canonical list used for the department dropdown across the app."
        actions={
          isAdmin && !showCreate ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              New department
            </button>
          ) : undefined
        }
      />

      {err && (
        <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {err}
        </p>
      )}

      {showCreate && isAdmin && (
        <NewDepartmentForm
          onCreated={() => {
            setShowCreate(false);
            setTick((t) => t + 1);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <TableShell>
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <Th>Name</Th>
            <Th>Description</Th>
            <Th className="text-right">Employees</Th>
            {isAdmin && <Th className="text-right pr-4">Actions</Th>}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td
                colSpan={isAdmin ? 4 : 3}
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                Loading…
              </td>
            </tr>
          )}
          {!loading && items.length === 0 && (
            <tr>
              <td
                colSpan={isAdmin ? 4 : 3}
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                No departments yet.
              </td>
            </tr>
          )}
          {items.map((d) =>
            editingId === d.id ? (
              <EditDepartmentRow
                key={d.id}
                department={d}
                onDone={() => {
                  setEditingId(null);
                  setTick((t) => t + 1);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <tr
                key={d.id}
                className="border-b border-border/60 last:border-0 transition-colors hover:bg-accent/40"
              >
                <td className="px-4 py-2.5 font-medium">{d.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {d.description ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {d.employee_count.toLocaleString()}
                </td>
                {isAdmin && (
                  <td className="pr-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingId(d.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      <ConfirmButton
                        label="Delete"
                        icon={<Trash2 className="h-3 w-3" />}
                        onConfirm={() => remove(d)}
                      />
                    </div>
                  </td>
                )}
              </tr>
            ),
          )}
        </tbody>
      </TableShell>
    </div>
  );
}

function NewDepartmentForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await apiFetch<Department>("/api/v1/departments", {
        method: "POST",
        json: {
          name: name.trim(),
          description: description.trim() || null,
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
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm font-medium">New department</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name" htmlFor="dept-new-name">
            <Input
              id="dept-new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Marketing"
              required
            />
          </Field>
          <Field
            label="Description (optional)"
            htmlFor="dept-new-description"
          >
            <Input
              id="dept-new-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brand, growth, campaigns"
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
            disabled={busy || !name.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function EditDepartmentRow({
  department,
  onDone,
  onCancel,
}: {
  department: Department;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description ?? "");
  const [cascade, setCascade] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      const query = cascade ? "?cascade=true" : "?cascade=false";
      await apiFetch<Department>(`/api/v1/departments/${department.id}${query}`, {
        method: "PATCH",
        json: {
          name: name.trim(),
          description: description.trim() || null,
        },
      });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-b border-border/60 bg-accent/30">
      <td className="px-4 py-2.5" colSpan={4}>
        <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Name"
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            aria-label="Description"
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={cascade}
                onChange={(e) => setCascade(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-ring"
              />
              Cascade rename
            </label>
            <button
              type="button"
              onClick={save}
              disabled={busy || !name.trim()}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium transition hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
        {err && (
          <p className="mt-2 rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
            {err}
          </p>
        )}
      </td>
    </tr>
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
