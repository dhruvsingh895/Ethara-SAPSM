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
        "rounded-xl border border-border bg-card text-card-foreground shadow-soft",
        "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A big, prominent stat card for the dashboard.
 * - Small caps label
 * - Large tabular number
 * - Optional hint / delta
 */
export function Stat({
  label,
  value,
  hint,
  icon,
  trend,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  trend?: { direction: "up" | "down" | "flat"; text: string };
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="label-cap">{label}</p>
        {icon && (
          <span className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
            {icon}
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
        {value}
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
              trend.direction === "up" && "bg-success/10 text-success",
              trend.direction === "down" && "bg-danger/10 text-danger",
              trend.direction === "flat" && "bg-muted text-muted-foreground",
            )}
          >
            {trend.direction === "up" && "↑ "}
            {trend.direction === "down" && "↓ "}
            {trend.text}
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </Card>
  );
}

const STATUS_STYLES: Record<string, string> = {
  available:
    "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
  occupied:
    "bg-indigo-500/10 text-indigo-700 ring-indigo-500/20 dark:text-indigo-300",
  reserved:
    "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300",
  blocked:
    "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300",
  active:
    "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300",
  on_leave:
    "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300",
  exited:
    "bg-neutral-500/10 text-neutral-700 ring-neutral-500/20 dark:text-neutral-300",
  on_hold:
    "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300",
  completed:
    "bg-neutral-500/10 text-neutral-700 ring-neutral-500/20 dark:text-neutral-300",
  admin:
    "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300",
  hr: "bg-pink-500/10 text-pink-700 ring-pink-500/20 dark:text-pink-300",
  pm: "bg-indigo-500/10 text-indigo-700 ring-indigo-500/20 dark:text-indigo-300",
  employee:
    "bg-neutral-500/10 text-neutral-700 ring-neutral-500/20 dark:text-neutral-300",
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
    "bg-neutral-500/10 text-neutral-700 ring-neutral-500/20 dark:text-neutral-300";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        cls,
      )}
    >
      {children ?? status.replace(/_/g, " ")}
    </span>
  );
}

export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

/**
 * Primary section header used at the top of pages and card groups.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
