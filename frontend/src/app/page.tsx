import Link from "next/link";

const features = [
  {
    title: "Employees",
    body: "~5,000 profiles with department, project, and seat context.",
  },
  {
    title: "Seats",
    body: "3 buildings × 5 floors × 4 zones. Allocate, release, transfer.",
  },
  {
    title: "Projects",
    body: "Roster, allocation %, PM, utilization metrics.",
  },
  {
    title: "AI Assistant",
    body: "Ask in plain English — Gemini turns it into a safe SQL query.",
  },
];

export default function HomePage() {
  return (
    <main className="container py-16">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Ethara SAPSM
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Seat Allocation &amp; Project Mapping System.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Phase 0 — scaffold. Login and dashboards land in Phase 5.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/health"
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            System status
          </Link>
          <a
            href="https://github.com/dhruvsingh895/Ethara-SAPSM"
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
          >
            View on GitHub
          </a>
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-lg border p-5 shadow-sm transition hover:shadow"
          >
            <h3 className="font-medium">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
