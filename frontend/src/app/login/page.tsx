"use client";

import { Eye, EyeOff, LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Field, Input } from "@/components/input";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const DEMO_ACCOUNTS = [
  { username: "admin", role: "Administrator" },
  { username: "hr", role: "HR" },
  { username: "pm", role: "Project Manager" },
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
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="relative flex min-h-screen items-center justify-center bg-background p-6">
      {/* Ambient decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center">
            <Logo size={56} priority />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Welcome to Ethara SAPSM
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to manage seats, projects, and people.
          </p>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Username or email" htmlFor="login-username">
              <Input
                id="login-username"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                placeholder="admin"
              />
            </Field>
            <Field label="Password" htmlFor="login-password">
              <div className="relative">
                <Input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </Field>
            {error && (
              <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        {/* Demo accounts */}
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Demo accounts</p>
            <p className="text-[11px] text-muted-foreground">
              Password: <code className="font-mono">demo1234</code>
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.username}
                type="button"
                onClick={() => setUsername(a.username)}
                className={
                  "flex flex-col items-start gap-0.5 rounded-md border border-border bg-background px-2.5 py-2 text-left text-xs transition hover:border-primary/50 hover:bg-accent " +
                  (username === a.username ? "border-primary/50 bg-accent" : "")
                }
              >
                <span className="font-mono font-medium">{a.username}</span>
                <span className="text-[11px] text-muted-foreground">
                  {a.role}
                </span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          Ethara SAPSM · v0.1.0
        </p>
      </div>
    </main>
  );
}
