"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

// Generic multi-select popover: replaces native <select multiple> (which
// needs ctrl/cmd/shift-click) with a button + checkbox-list popover, click
// to toggle. Works for any {_id, name}-shaped list — people or tasks.
export default function MultiSelect({
  label,
  ariaLabel,
  items,
  value = [],
  onChange,
  placeholder = "Select…",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const byId = useMemo(() => new Map(items.map((i) => [i._id, i])), [items]);
  const filtered = useMemo(
    () => items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  const toggle = (id) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const summary = value.length
    ? value
        .slice(0, 2)
        .map((id) => byId.get(id)?.name)
        .filter(Boolean)
        .join(", ") + (value.length > 2 ? ` +${value.length - 2}` : "")
    : placeholder;

  return (
    <div className="relative">
      {label && <label className="text-sm font-medium">{label}</label>}
      <button
        type="button"
        aria-label={ariaLabel || label}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`mt-1 flex w-full items-center justify-between gap-2 rounded-input border border-border bg-surface px-3 py-2 text-left text-sm outline-none transition-colors duration-150 focus:border-primary disabled:opacity-50 ${
          value.length ? "" : "text-muted"
        }`}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown size={15} className="shrink-0 text-muted" />
      </button>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 right-0 z-40 mt-1 rounded-dropdown border border-border bg-surface shadow-md animate-[fadeIn_150ms_ease-out]">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search size={14} className="shrink-0 text-muted" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto py-1">
              {filtered.map((item) => (
                <li key={item._id}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-background">
                    <input
                      type="checkbox"
                      checked={value.includes(item._id)}
                      onChange={() => toggle(item._id)}
                      className="accent-primary"
                    />
                    <span className="truncate">{item.name}</span>
                  </label>
                </li>
              ))}
              {!filtered.length && <li className="px-3 py-2 text-sm text-muted">No matches.</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
