import { apiUrl } from "@/lib/api";

async function fetchHealth() {
  try {
    const res = await fetch(apiUrl("/api/v1/health"), { cache: "no-store" });
    if (!res.ok) return { status: `error ${res.status}` };
    return (await res.json()) as Record<string, string>;
  } catch (err) {
    return { status: "unreachable", detail: String(err) };
  }
}

export default async function HealthPage() {
  const data = await fetchHealth();
  return (
    <main className="container py-16">
      <h1 className="text-2xl font-semibold">Backend status</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Live probe of {apiUrl("/api/v1/health")}
      </p>
      <pre className="mt-6 rounded-lg border bg-muted p-4 text-sm">
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  );
}
