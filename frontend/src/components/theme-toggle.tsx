"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "@/lib/theme-context";

export function ThemeToggle() {
  const { theme, cycle } = useTheme();

  const label =
    theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${label} (click to change)`}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
