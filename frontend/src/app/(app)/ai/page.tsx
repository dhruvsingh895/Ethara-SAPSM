"use client";

import { History, Send, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge, Card, PageHeader } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AiHistoryEntry, AiQueryResponse } from "@/lib/types";

const EXAMPLES = [
  "How many seats are available on floor 3?",
  "Show me 10 employees in the Engineering department",
  "Which projects are for client Aurora Bank?",
  "How many employees joined in the last 30 days?",
  "What's the occupancy percentage per floor?",
  "List the top 5 projects by member count",
];

type Entry =
  | {
      kind: "live";
      id: number;
      prompt: string;
      response?: AiQueryResponse;
      error?: string;
      pending: boolean;
    }
  | { kind: "history"; id: number; entry: AiHistoryEntry };

const STATUS_LABEL: Record<string, string> = {
  ok: "available",
  rejected: "maintenance",
  gemini_error: "maintenance",
  exec_error: "maintenance",
  unavailable: "reserved",
};

export default function AiPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [prompt, setPrompt] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [allUsers, setAllUsers] = useState(false);
  const [historyErr, setHistoryErr] = useState<string | null>(null);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;

    const id = Date.now();
    setEntries((h) => [{ kind: "live", id, prompt: q, pending: true }, ...h]);
    setPrompt("");
    setBusy(true);
    try {
      const r = await apiFetch<AiQueryResponse>("/api/v1/ai/query", {
        method: "POST",
        json: { prompt: q },
      });
      setEntries((h) =>
        h.map((e) =>
          e.kind === "live" && e.id === id
            ? { ...e, response: r, pending: false }
            : e,
        ),
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail : String(e);
      setEntries((h) =>
        h.map((e) =>
          e.kind === "live" && e.id === id
            ? { ...e, error: msg, pending: false }
            : e,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadHistory() {
    setHistoryErr(null);
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (isAdmin && allUsers) params.set("all_users", "true");
      const rows = await apiFetch<AiHistoryEntry[]>(
        `/api/v1/ai/history?${params.toString()}`,
      );
      setEntries((prev) => {
        const live = prev.filter((e) => e.kind === "live");
        const history: Entry[] = rows.map((r) => ({
          kind: "history",
          id: r.id,
          entry: r,
        }));
        return [...live, ...history];
      });
      setHistoryLoaded(true);
    } catch (e) {
      setHistoryErr(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Assistant"
        description="Ask the database in plain English. Gemini turns your question into a safe read-only SQL query."
      />

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(prompt);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Sparkles className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="How many seats are available on floor 3?"
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              disabled={busy}
            />
          </div>
          <button
            type="submit"
            disabled={busy || !prompt.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {busy ? "Thinking…" : "Ask"}
          </button>
        </form>

        <div className="mt-4">
          <p className="label-cap mb-2">Try one of these</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => ask(ex)}
                disabled={busy}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs transition hover:border-primary/50 hover:bg-accent disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={loadHistory}
            disabled={historyLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-accent disabled:opacity-50"
          >
            <History className="h-3.5 w-3.5" />
            {historyLoading
              ? "Loading…"
              : historyLoaded
                ? "Refresh history"
                : "Load past queries"}
          </button>
          {isAdmin && (
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={allUsers}
                onChange={(e) => setAllUsers(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-ring"
              />
              Show all users (admin)
            </label>
          )}
          {historyErr && (
            <span className="text-xs text-danger">{historyErr}</span>
          )}
        </div>
      </Card>

      {entries.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Ask your first question</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your query history will appear here.
          </p>
        </div>
      )}

      {entries.map((e) =>
        e.kind === "live" ? (
          <LiveQueryCard key={`live-${e.id}`} entry={e} />
        ) : (
          <HistoryQueryCard
            key={`hist-${e.id}`}
            entry={e.entry}
            onAskAgain={ask}
            busy={busy}
          />
        ),
      )}
    </div>
  );
}

function LiveQueryCard({
  entry,
}: {
  entry: Extract<Entry, { kind: "live" }>;
}) {
  const { prompt, response, error, pending } = entry;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{prompt}</p>
        {response && (
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              {response.duration_ms} ms
            </span>
            <Badge status={STATUS_LABEL[response.status] ?? "maintenance"}>
              {response.status}
            </Badge>
          </div>
        )}
      </div>

      {pending && (
        <p className="mt-3 text-sm text-muted-foreground">
          Asking Gemini and checking the SQL…
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      {response?.answer && (
        <p className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          {response.answer}
        </p>
      )}

      {response?.sql && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            Generated SQL
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs">
            {response.sql}
          </pre>
        </details>
      )}

      {response?.status === "ok" && response.rows.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-md border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {response.columns.map((c) => (
                    <th
                      key={c}
                      className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {response.rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    {row.map((v, j) => (
                      <td key={j} className="px-3 py-2 tabular-nums">
                        {v === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          String(v)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
            {response.rows.length} row{response.rows.length === 1 ? "" : "s"}
          </p>
        </div>
      )}

      {response?.status === "ok" && response.rows.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Query ran successfully but returned no rows.
        </p>
      )}

      {response && response.status !== "ok" && response.error && (
        <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          {response.error}
        </p>
      )}
    </Card>
  );
}

function HistoryQueryCard({
  entry,
  onAskAgain,
  busy,
}: {
  entry: AiHistoryEntry;
  onAskAgain: (prompt: string) => void;
  busy: boolean;
}) {
  return (
    <Card className="border-dashed">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{entry.prompt}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date(entry.at).toLocaleString()}
            {entry.rows_returned != null && (
              <> · {entry.rows_returned} rows</>
            )}
            {entry.duration_ms != null && <> · {entry.duration_ms} ms</>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge status={STATUS_LABEL[entry.status] ?? "maintenance"}>
            {entry.status}
          </Badge>
          <button
            type="button"
            onClick={() => onAskAgain(entry.prompt)}
            disabled={busy}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium transition hover:bg-accent disabled:opacity-50"
          >
            Ask again
          </button>
        </div>
      </div>

      {entry.generated_sql && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            Generated SQL
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs">
            {entry.generated_sql}
          </pre>
        </details>
      )}

      {entry.error && (
        <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          {entry.error}
        </p>
      )}
    </Card>
  );
}
