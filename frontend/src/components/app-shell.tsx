"use client";

import {
  ArrowLeftRight,
  Building2,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareCode,
  Network,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AiChatWidget } from "@/components/ai-chat-widget";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/seats", label: "Seats", icon: Building2 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  {
    href: "/allocations",
    label: "Allocations",
    icon: ArrowLeftRight,
    roles: ["admin", "hr"],
  },
  {
    href: "/new-joiner",
    label: "New Joiner",
    icon: UserPlus,
    roles: ["admin", "hr"],
  },
  { href: "/ai", label: "AI Assistant", icon: MessageSquareCode },
  {
    href: "/departments",
    label: "Departments",
    icon: Network,
    roles: ["admin"],
  },
  {
    href: "/users",
    label: "Users",
    icon: KeyRound,
    roles: ["admin"],
  },
];

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrator",
  hr: "HR",
  pm: "Project Manager",
  employee: "Employee",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(
        `/login?next=${encodeURIComponent(pathname || "/dashboard")}`,
      );
    }
  }, [loading, user, router, pathname]);

  // Close the drawer whenever the route changes so nav clicks feel native.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when the drawer is open.
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </main>
    );
  }

  const items = NAV.filter((i) => !i.roles || i.roles.includes(user.role));

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Logo size={28} priority />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight">
            Ethara Seat Allocation &amp; Project Mapping System
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        <p className="mb-1 px-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>
        {items.map((it) => {
          const active =
            pathname === it.href || pathname?.startsWith(it.href + "/");
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="truncate">{it.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="text-xs font-semibold uppercase">
              {user.username.charAt(0)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.username}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {ROLE_LABEL[user.role]}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
        >
          <LogOut className="h-3.5 w-3.5" />
          Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-sidebar text-sidebar-foreground shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Mobile brand on top bar (only visible on small screens) */}
          <div className="flex items-center gap-2 md:hidden">
            <Logo size={22} />
            <span className="text-sm font-semibold tracking-tight">
              Ethara Seat Allocation &amp; Project Mapping System
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              className="hidden items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:inline-flex"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">{children}</div>
        </main>
      </div>

      {/* Floating chat widget, self-hides on /login and /ai */}
      <AiChatWidget />
    </div>
  );
}
