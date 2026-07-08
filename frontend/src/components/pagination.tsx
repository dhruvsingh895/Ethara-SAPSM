"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Full-featured pagination bar.
 * - First, Previous, Next, Last buttons
 * - Editable "page N of M" input so you can jump directly
 * - Total rows label on the left
 */
export function Pagination({
  offset,
  limit,
  total,
  label = "rows",
  onChange,
}: {
  offset: number;
  limit: number;
  total: number;
  label?: string;
  onChange: (offset: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  const [pageInput, setPageInput] = useState(String(currentPage));

  // Keep the local input in sync when parent changes offset (Prev/Next).
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  function goToPage(page: number) {
    const clamped = Math.min(Math.max(1, page), totalPages);
    onChange((clamped - 1) * limit);
  }

  function submitPageInput(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(pageInput, 10);
    if (!Number.isNaN(n)) goToPage(n);
    else setPageInput(String(currentPage));
  }

  return (
    <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">
        <span className="tabular-nums">{total.toLocaleString()}</span> {label}
        {total > 0 && (
          <>
            {" "}
            · showing{" "}
            <span className="tabular-nums">
              {(offset + 1).toLocaleString()}–
              {Math.min(offset + limit, total).toLocaleString()}
            </span>
          </>
        )}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => goToPage(1)}
          disabled={currentPage === 1}
          title="First page"
          aria-label="First page"
          className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-2 transition hover:bg-accent disabled:opacity-40"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          title="Previous page"
          aria-label="Previous page"
          className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium transition hover:bg-accent disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        <form
          onSubmit={submitPageInput}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          <span className="text-muted-foreground">Page</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
            onBlur={submitPageInput}
            aria-label={`Page number, current page ${currentPage} of ${totalPages}`}
            className="w-10 rounded-sm bg-transparent text-center font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="text-muted-foreground">
            of <span className="tabular-nums">{totalPages}</span>
          </span>
        </form>

        <button
          type="button"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="Next page"
          aria-label="Next page"
          className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium transition hover:bg-accent disabled:opacity-40"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => goToPage(totalPages)}
          disabled={currentPage >= totalPages}
          title="Last page"
          aria-label="Last page"
          className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-2 transition hover:bg-accent disabled:opacity-40"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
