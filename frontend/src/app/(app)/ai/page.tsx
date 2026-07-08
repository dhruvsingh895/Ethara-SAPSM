"use client";

import { useState } from "react";

import { Badge, Card } from "@/components/ui";
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
  rejected: "blocked",
  gemini_error: "blocked",
  exec_error: "blocked",
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
      // Drop any existing history entries, keep live ones on top.
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
    <div className="space-y-4">
      <Card>
        <p className="text-sm font-medium">Ask the database in plain English</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Gemini turns your question into a read-only SQL query. Blocked queries
          are logged for audit. Sensitive tables (users, audit_log) are
          restricted.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(prompt);
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="How many seats are available on floor 3?"
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !prompt.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Thinking…" : "Ask"}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => ask(ex)}
              disabled={busy}
              className="rounded-full border bg-background px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3">
          <button
            type="button"
            onClick={loadHistory}
            disabled={historyLoading}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
          >
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
              />
              Show all users (admin)
            </label>
          )}
          {historyErr && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {historyErr}
            </span>
          )}
        </div>
      </Card>

      {entries.length === 0 && (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Your query history will appear here.
        </p>
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
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              {response.duration_ms} ms
            </span>
            <Badge status={STATUS_LABEL[response.status] ?? "blocked"}>
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
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      {response?.sql && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Generated SQL
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {response.sql}
          </pre>
        </details>
      )}

      {response?.status === "ok" && response.rows.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                {response.columns.map((c) => (
                  <th key={c} className="px-3 py-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {response.rows.map((row, i) => (
                <tr key={i} className="border-t">
                  {row.map((v, j) => (
                    <td key={j} className="px-3 py-1.5">
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
          <p className="border-t bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
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
        <p className="mt-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200">
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
          <Badge status={STATUS_LABEL[entry.status] ?? "blocked"}>
            {entry.status}
          </Badge>
          <button
            type="button"
            onClick={() => onAskAgain(entry.prompt)}
            disabled={busy}
            className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
          >
            Ask again
          </button>
        </div>
      </div>

      {entry.generated_sql && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Generated SQL
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {entry.generated_sql}
          </pre>
        </details>
      )}

      {entry.error && (
        <p className="mt-3 rounded-md bg-yellow-50 p-3 text-xs text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200">
          {entry.error}
        </p>
      )}
    </Card>
  );
}
