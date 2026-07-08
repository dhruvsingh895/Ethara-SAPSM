"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Two-click delete/destructive button.
 * First click swaps to "Yes, X?" + Cancel. Second click runs onConfirm.
 */
export function ConfirmButton({
  label = "Delete",
  confirmLabel = "Yes, delete",
  onConfirm,
  variant = "danger",
  className,
  disabled = false,
  icon,
}: {
  label?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  variant?: "danger" | "primary";
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function fire() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setArmed(false);
    }
  }

  const base =
    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
  const danger =
    "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20";
  const primary =
    "bg-primary text-primary-foreground hover:opacity-90";

  if (!armed) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setArmed(true)}
        className={cn(base, variant === "danger" ? danger : primary, className)}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={fire}
        className={cn(base, variant === "danger" ? danger : primary)}
      >
        {busy ? "…" : confirmLabel}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setArmed(false)}
        className={cn(
          base,
          "border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        Cancel
      </button>
    </span>
  );
}
