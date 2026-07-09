"use client";

import { Maximize2, MessageSquareCode, Send, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AiQueryResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  "Which floors have the most available Engineering seats?",
  "Which projects are over-allocated?",
  "Who are the most recent joiners in Product?",
  "How many seats are under maintenance?",
];

interface Turn {
  id: number;
  prompt: string;
  response?: AiQueryResponse;
  error?: string;
  pending: boolean;
}

/**
 * Floating chat widget that lives on every authenticated page.
 * Uses the same /ai/query endpoint as the full page but is read-only
 * and compact - great for quick allocation-suggestion questions
 * without leaving the current view.
 */
export function AiChatWidget() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to latest turn.
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, open]);

  // Don't render on the login page or before login.
  if (!user) return null;
  if (pathname?.startsWith("/login")) return null;
  // Don't double up on the AI page itself.
  if (pathname?.startsWith("/ai")) return null;

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const id = Date.now();
    setTurns((t) => [...t, { id, prompt: q, pending: true }]);
    setPrompt("");
    setBusy(true);
    try {
      const r = await apiFetch<AiQueryResponse>("/api/v1/ai/query", {
        method: "POST",
        json: { prompt: q },
      });
      setTurns((t) =>
        t.map((x) => (x.id === id ? { ...x, response: r, pending: false } : x)),
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail : String(e);
      setTurns((t) =>
        t.map((x) => (x.id === id ? { ...x, error: msg, pending: false } : x)),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ask the AI assistant"
        aria-label="Open AI assistant chat"
        className={cn(
          "fixed bottom-4 right-4 z-40",
          "flex h-12 w-12 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground shadow-lg shadow-primary/30",
          "transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <MessageSquareCode className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-40",
        "flex h-[540px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl",
      )}
      role="dialog"
      aria-label="AI assistant"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <p className="text-sm font-semibold">AI Assistant</p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/ai"
            title="Open full AI Assistant"
            aria-label="Open full AI Assistant"
            className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            title="Close"
            aria-label="Close chat"
            className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {turns.length === 0 && (
          <div className="text-xs text-muted-foreground">
            <p className="mb-2">
              Ask a question about seats, projects, or people. I can only
              read - I never allocate on my own.
            </p>
            <p className="mb-1 font-medium">Try:</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => ask(p)}
                  disabled={busy}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] transition hover:border-primary/50 hover:bg-accent disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t) => (
          <div key={t.id} className="space-y-1.5">
            {/* User bubble */}
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-xs text-primary-foreground">
                {t.prompt}
              </div>
            </div>

            {/* Assistant bubble */}
            <div className="flex justify-start">
              <div className="max-w-[85%] space-y-2 rounded-2xl rounded-bl-sm border border-border bg-background px-3 py-2 text-xs">
                {t.pending && (
                  <p className="text-muted-foreground">Thinking…</p>
                )}
                {t.error && (
                  <p className="text-danger">{t.error}</p>
                )}
                {t.response && t.response.status !== "ok" && (
                  <p className="text-warning">
                    {t.response.error ?? "Blocked by safety guard"}
                  </p>
                )}
                {t.response?.sql && (
                  <details>
                    <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                      SQL · {t.response.duration_ms} ms
                    </summary>
                    <pre className="mt-1.5 overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-[10px]">
                      {t.response.sql}
                    </pre>
                  </details>
                )}
                {t.response?.status === "ok" &&
                  t.response.rows.length > 0 && (
                    <MiniResult
                      columns={t.response.columns}
                      rows={t.response.rows}
                    />
                  )}
                {t.response?.status === "ok" &&
                  t.response.rows.length === 0 && (
                    <p className="text-muted-foreground">
                      Query ran but returned no rows.
                    </p>
                  )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(prompt);
        }}
        className="flex items-center gap-2 border-t border-border p-2"
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask about seats, projects, people…"
          disabled={busy}
          className="h-9 flex-1 rounded-md border border-border bg-background px-2.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <button
          type="submit"
          disabled={busy || !prompt.trim()}
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-2.5 text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}

function MiniResult({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<string | number | boolean | null>>;
}) {
  const preview = rows.slice(0, 6);
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="max-h-40 overflow-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {columns.map((c) => (
                <th
                  key={c}
                  className="px-2 py-1 text-left font-medium text-muted-foreground"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0">
                {row.map((v, j) => (
                  <td key={j} className="px-2 py-1 tabular-nums">
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
      <p className="border-t border-border bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground">
        {rows.length === 1 ? "1 row" : `${rows.length} rows`}
        {rows.length > preview.length && ` · showing first ${preview.length}`}
      </p>
    </div>
  );
}
