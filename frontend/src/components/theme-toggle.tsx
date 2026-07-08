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
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm hover:bg-accent"
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
