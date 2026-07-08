"use client";

import { Check, Copy, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ConfirmButton } from "@/components/confirm";
import { Field, Input, Select } from "@/components/input";
import { Badge, Card, PageHeader, TableShell } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { User, UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["admin", "hr", "pm", "employee"];

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrator",
  hr: "HR",
  pm: "Project Manager",
  employee: "Employee",
};

export default function UsersPage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [tick, setTick] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [lastCreated, setLastCreated] = useState<{
    username: string;
    password: string;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<User[]>("/api/v1/users")
      .then(setItems)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [tick]);

  if (!isAdmin) {
    return (
      <p className="rounded-md border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
        Only admin can manage users.
      </p>
    );
  }

  async function remove(id: number) {
    setErr(null);
    setBusyId(id);
    try {
      await apiFetch(`/api/v1/users/${id}`, { method: "DELETE" });
      setTick((t) => t + 1);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(u: User) {
    setErr(null);
    setBusyId(u.id);
    try {
      const updated = await apiFetch<User>(`/api/v1/users/${u.id}`, {
        method: "PATCH",
        json: { is_active: !u.is_active },
      });
      setItems((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function changeRole(u: User, newRole: UserRole) {
    if (newRole === u.role) return;
    setErr(null);
    setBusyId(u.id);
    try {
      const updated = await apiFetch<User>(`/api/v1/users/${u.id}`, {
        method: "PATCH",
        json: { role: newRole },
      });
      setItems((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Login credentials with role-based access. Admin can create HR/PM/employee accounts to hand out."
        actions={
          !showCreate ? (
            <button
              type="button"
              onClick={() => {
                setShowCreate(true);
                setLastCreated(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              New user
            </button>
          ) : undefined
        }
      />

      {err && (
        <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {err}
        </p>
      )}

      {lastCreated && (
        <CredentialsPanel
          username={lastCreated.username}
          password={lastCreated.password}
          onDismiss={() => setLastCreated(null)}
        />
      )}

      {showCreate && (
        <NewUserForm
          onCreated={(username, password) => {
            setShowCreate(false);
            setLastCreated({ username, password });
            setTick((t) => t + 1);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <TableShell>
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <Th>Username</Th>
            <Th>Email</Th>
            <Th>Role</Th>
            <Th>Active</Th>
            <Th className="text-right pr-4">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                Loading…
              </td>
            </tr>
          )}
          {!loading && items.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                No users yet.
              </td>
            </tr>
          )}
          {items.map((u) => {
            const isSelf = user?.id === u.id;
            const busy = busyId === u.id;
            return (
              <tr
                key={u.id}
                className="border-b border-border/60 last:border-0 transition-colors hover:bg-accent/40"
              >
                <td className="px-4 py-2.5 font-medium">
                  <span className="font-mono">{u.username}</span>
                  {isSelf && (
                    <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      you
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-2.5">
                  <div className="inline-flex items-center gap-1.5">
                    <Badge status={u.role}>{ROLE_LABEL[u.role]}</Badge>
                    {!isSelf && (
                      <Select
                        aria-label={`Change role for ${u.username}`}
                        value={u.role}
                        disabled={busy}
                        onChange={(e) =>
                          changeRole(u, e.target.value as UserRole)
                        }
                        className="h-7 w-28 py-0 text-[11px]"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="inline-flex items-center gap-1.5">
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300">
                        <Check className="h-3 w-3" />
                        active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
                        <X className="h-3 w-3" />
                        disabled
                      </span>
                    )}
                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => toggleActive(u)}
                        disabled={busy}
                        className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] transition hover:bg-accent disabled:opacity-50"
                      >
                        {u.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    )}
                  </div>
                </td>
                <td className="pr-4 py-2.5 text-right">
                  {!isSelf && (
                    <ConfirmButton
                      label="Delete"
                      icon={<Trash2 className="h-3 w-3" />}
                      disabled={busy}
                      onConfirm={() => remove(u.id)}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>
    </div>
  );
}

function CredentialsPanel({
  username,
  password,
  onDismiss,
}: {
  username: string;
  password: string;
  onDismiss: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  async function copy(value: string, field: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // Clipboard may not be available; ignore.
    }
  }

  return (
    <Card className="border-success/40 bg-success/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-success">
            User created. Share these credentials securely.
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The password won&apos;t appear again — copy it now.
          </p>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <div className="rounded-md border border-border bg-background p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Username
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <code className="font-mono text-sm">{username}</code>
                <button
                  type="button"
                  onClick={() => copy(username, "username")}
                  className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  aria-label="Copy username"
                >
                  {copiedField === "username" ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <div className="rounded-md border border-border bg-background p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Password
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <code className="font-mono text-sm">
                  {showPassword ? password : "•".repeat(password.length)}
                </code>
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  aria-label={showPassword ? "Hide" : "Show"}
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => copy(password, "password")}
                  className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  aria-label="Copy password"
                >
                  {copiedField === "password" ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}

function NewUserForm({
  onCreated,
  onCancel,
}: {
  onCreated: (username: string, password: string) => void;
  onCancel: () => void;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [role, setRole] = useState<UserRole>("hr");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await apiFetch<User>("/api/v1/users", {
        method: "POST",
        json: {
          username: username.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          password,
          role,
        },
      });
      onCreated(username.trim().toLowerCase(), password);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm font-medium">New user</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Username" htmlFor="user-new-username">
            <Input
              id="user-new-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="hr2"
              required
              minLength={3}
              maxLength={64}
              autoComplete="off"
            />
          </Field>
          <Field label="Email" htmlFor="user-new-email">
            <Input
              id="user-new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hr2@ethara.dev"
              required
              autoComplete="off"
            />
          </Field>
          <Field label="Role" htmlFor="user-new-role">
            <Select
              id="user-new-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Password (autogenerated, editable)" htmlFor="user-new-password">
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Input
                  id="user-new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pr-9 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  aria-label={showPassword ? "Hide" : "Show"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                title="Generate a new random password"
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition hover:bg-accent"
              >
                Regenerate
              </button>
            </div>
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
            {busy ? "Creating…" : "Create user"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function generatePassword(length = 14): string {
  // Human-friendly: mix upper, lower, digit, symbol, avoiding lookalikes.
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;
  const cryptoObj =
    typeof window !== "undefined" && "crypto" in window
      ? window.crypto
      : undefined;
  const randInt = (max: number): number => {
    if (cryptoObj) {
      const buf = new Uint32Array(1);
      cryptoObj.getRandomValues(buf);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  };
  // Ensure at least one of each class.
  const required = [
    upper[randInt(upper.length)],
    lower[randInt(lower.length)],
    digits[randInt(digits.length)],
    symbols[randInt(symbols.length)],
  ];
  const remaining = Array.from({ length: length - required.length }, () =>
    all[randInt(all.length)],
  );
  const chars = [...required, ...remaining];
  // Fisher-Yates shuffle.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
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
