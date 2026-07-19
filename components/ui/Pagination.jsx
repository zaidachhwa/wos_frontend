"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

// Compact page-number window: first, last, current ± 1, with "…" gaps.
const pageWindow = (page, totalPages) => {
  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  return [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
};

export default function Pagination({ page, totalPages, total, onPageChange }) {
  if (totalPages <= 1) return null;
  const pages = pageWindow(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <p className="text-xs text-muted">
        Page {page} of {totalPages}
        {typeof total === "number" && <span> · {total} total</span>}
      </p>
      <div className="flex items-center gap-1 rounded-btn border border-border bg-surface p-1">
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-[8px] p-1.5 text-muted transition-colors duration-150 hover:text-primary disabled:opacity-40 disabled:hover:text-muted"
        >
          <ChevronLeft size={15} />
        </button>
        {pages.map((p, i) => (
          <span key={p} className="flex items-center">
            {i > 0 && p - pages[i - 1] > 1 && <span className="px-1 text-xs text-muted">…</span>}
            <button
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={`min-w-[28px] rounded-[8px] px-2 py-1 text-sm font-medium tabular-nums transition-colors duration-150 ${
                p === page ? "bg-primary text-primary-foreground" : "text-muted hover:text-primary"
              }`}
            >
              {p}
            </button>
          </span>
        ))}
        <button
          type="button"
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-[8px] p-1.5 text-muted transition-colors duration-150 hover:text-primary disabled:opacity-40 disabled:hover:text-muted"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
