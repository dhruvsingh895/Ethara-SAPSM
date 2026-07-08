import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-background p-5 shadow-sm dark:bg-slate-900/50",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

const STATUS_STYLES: Record<string, string> = {
  available:
    "bg-green-100 text-green-800 ring-green-300 dark:bg-green-950 dark:text-green-200 dark:ring-green-800",
  occupied:
    "bg-blue-100 text-blue-800 ring-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-800",
  reserved:
    "bg-yellow-100 text-yellow-800 ring-yellow-300 dark:bg-yellow-950 dark:text-yellow-200 dark:ring-yellow-800",
  blocked:
    "bg-red-100 text-red-800 ring-red-300 dark:bg-red-950 dark:text-red-200 dark:ring-red-800",
  active:
    "bg-green-100 text-green-800 ring-green-300 dark:bg-green-950 dark:text-green-200 dark:ring-green-800",
  on_leave:
    "bg-yellow-100 text-yellow-800 ring-yellow-300 dark:bg-yellow-950 dark:text-yellow-200 dark:ring-yellow-800",
  exited:
    "bg-neutral-200 text-neutral-800 ring-neutral-300 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-600",
  on_hold:
    "bg-yellow-100 text-yellow-800 ring-yellow-300 dark:bg-yellow-950 dark:text-yellow-200 dark:ring-yellow-800",
  completed:
    "bg-neutral-200 text-neutral-800 ring-neutral-300 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-600",
  admin:
    "bg-purple-100 text-purple-800 ring-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:ring-purple-800",
  hr:
    "bg-pink-100 text-pink-800 ring-pink-300 dark:bg-pink-950 dark:text-pink-200 dark:ring-pink-800",
  pm:
    "bg-blue-100 text-blue-800 ring-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-800",
  employee:
    "bg-neutral-100 text-neutral-800 ring-neutral-300 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-600",
};

export function Badge({
  status,
  children,
}: {
  status: string;
  children?: React.ReactNode;
}) {
  const cls =
    STATUS_STYLES[status] ??
    "bg-neutral-100 text-neutral-800 ring-neutral-300 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-600";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        cls,
      )}
    >
      {children ?? status.replace(/_/g, " ")}
    </span>
  );
}

export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
