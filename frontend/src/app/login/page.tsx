"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const DEMO_ACCOUNTS = [
  { username: "admin", role: "Admin" },
  { username: "hr", role: "HR" },
  { username: "pm", role: "PM" },
  { username: "employee", role: "Employee" },
];

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Loading…
    </main>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") ?? "/dashboard";
  const { user, login, loading } = useAuth();

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(nextPath);
  }, [user, loading, nextPath, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
      router.replace(nextPath);
    } catch (err) {
      if (err instanceof ApiError) setError(err.detail);
      else setError("Login failed. Is the backend running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Ethara SAPSM</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to manage seats, projects, and people.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-lg border p-6 shadow-sm"
        >
          <div className="space-y-1">
            <label htmlFor="login-username" className="text-sm font-medium">
              Username or email
            </label>
            <input
              id="login-username"
              name="username"
              placeholder="admin"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="login-password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              placeholder="••••••••"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="rounded-md border bg-muted/40 p-4 text-sm">
          <p className="font-medium">Demo accounts</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Password for all: <code>demo1234</code>
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.username}>
                <button
                  type="button"
                  onClick={() => setUsername(a.username)}
                  className="w-full rounded border bg-background px-2 py-1 text-left text-xs hover:bg-accent"
                >
                  <span className="font-mono">{a.username}</span>
                  <span className="ml-2 text-muted-foreground">{a.role}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
