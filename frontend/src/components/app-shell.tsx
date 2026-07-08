"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  roles?: UserRole[];
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/employees", label: "Employees" },
  { href: "/seats", label: "Seats" },
  { href: "/projects", label: "Projects" },
  { href: "/allocations", label: "Allocations", roles: ["admin", "hr"] },
  { href: "/new-joiner", label: "New Joiner", roles: ["admin", "hr"] },
  { href: "/ai", label: "AI Assistant" },
];

function pageTitle(pathname: string | null): string {
  if (!pathname || pathname === "/") return "";
  const first = pathname.replace(/^\//, "").split("/")[0];
  const item = NAV.find((n) => n.href === `/${first}`);
  if (item) return item.label;
  return first
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(
        `/login?next=${encodeURIComponent(pathname || "/dashboard")}`,
      );
    }
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </main>
    );
  }

  const items = NAV.filter((i) => !i.roles || i.roles.includes(user.role));

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r bg-muted/30 p-4 md:block">
        <div className="mb-6">
          <p className="text-lg font-semibold">Ethara SAPSM</p>
          <p className="text-xs text-muted-foreground">v0.1.0</p>
        </div>
        <nav className="space-y-1">
          {items.map((it) => {
            const active =
              pathname === it.href || pathname?.startsWith(it.href + "/");
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent",
                )}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {pageTitle(pathname)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{user.username}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {user.role}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Log out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-x-auto p-6">{children}</main>
      </div>
    </div>
  );
}
