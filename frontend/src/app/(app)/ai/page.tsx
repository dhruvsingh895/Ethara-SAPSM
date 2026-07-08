"use client";

import { useState } from "react";

import { Badge, Card } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import type { AiQueryResponse } from "@/lib/types";

const EXAMPLES = [
  "How many seats are available on floor 3?",
  "Show me 10 employees in the Engineering department",
  "Which projects are for client Aurora Bank?",
  "How many employees joined in the last 30 days?",
  "What's the occupancy percentage per floor?",
  "List the top 5 projects by member count",
];

interface HistoryEntry {
  id: number;
  prompt: string;
  response?: AiQueryResponse;
  error?: string;
  pending: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  ok: "available",
  rejected: "blocked",
  gemini_error: "blocked",
  exec_error: "blocked",
  unavailable: "reserved",
};

export default function AiPage() {
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;

    const id = Date.now();
    setHistory((h) => [{ id, prompt: q, pending: true }, ...h]);
    setPrompt("");
    setBusy(true);
    try {
      const r = await apiFetch<AiQueryResponse>("/api/v1/ai/query", {
        method: "POST",
        json: { prompt: q },
      });
      setHistory((h) =>
        h.map((e) => (e.id === id ? { ...e, response: r, pending: false } : e)),
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail : String(e);
      setHistory((h) =>
        h.map((e) => (e.id === id ? { ...e, error: msg, pending: false } : e)),
      );
    } finally {
      setBusy(false);
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
      </Card>

      {history.length === 0 && (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Your query history will appear here.
        </p>
      )}

      {history.map((h) => (
        <QueryCard key={h.id} entry={h} />
      ))}
    </div>
  );
}

function QueryCard({ entry }: { entry: HistoryEntry }) {
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
