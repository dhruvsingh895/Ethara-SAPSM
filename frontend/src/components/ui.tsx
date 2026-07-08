import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border bg-background p-5 shadow-sm", className)}>
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
  available: "bg-green-100 text-green-800 ring-green-300",
  occupied: "bg-blue-100 text-blue-800 ring-blue-300",
  reserved: "bg-yellow-100 text-yellow-800 ring-yellow-300",
  blocked: "bg-red-100 text-red-800 ring-red-300",
  active: "bg-green-100 text-green-800 ring-green-300",
  on_leave: "bg-yellow-100 text-yellow-800 ring-yellow-300",
  exited: "bg-neutral-200 text-neutral-800 ring-neutral-300",
  on_hold: "bg-yellow-100 text-yellow-800 ring-yellow-300",
  completed: "bg-neutral-200 text-neutral-800 ring-neutral-300",
  admin: "bg-purple-100 text-purple-800 ring-purple-300",
  hr: "bg-pink-100 text-pink-800 ring-pink-300",
  pm: "bg-blue-100 text-blue-800 ring-blue-300",
  employee: "bg-neutral-100 text-neutral-800 ring-neutral-300",
};

export function Badge({
  status,
  children,
}: {
  status: string;
  children?: React.ReactNode;
}) {
  const cls = STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-800 ring-neutral-300";
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
