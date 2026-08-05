"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

// Generic select popover with search: replaces native <select multiple>
// (which needs ctrl/cmd/shift-click) with a button + checkbox-list popover,
// click to toggle. Works for any {_id, name}-shaped list — people or tasks.
// Pass multiple={false} for a searchable single-select (value/onChange are
// then a plain id string, and picking an item closes the popover).
export default function MultiSelect({
  label,
  ariaLabel,
  items,
  value,
  onChange,
  placeholder = "Select…",
  disabled = false,
  multiple = true,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = multiple ? value || [] : value ? [value] : [];

  const byId = useMemo(() => new Map(items.map((i) => [i._id, i])), [items]);
  const filtered = useMemo(
    () => items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  const toggle = (id) => {
    if (!multiple) {
      onChange(id);
      setOpen(false);
      return;
    }
    onChange(selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id]);
  };

  const summary = multiple
    ? selected.length
      ? selected
          .slice(0, 2)
          .map((id) => byId.get(id)?.name)
          .filter(Boolean)
          .join(", ") + (selected.length > 2 ? ` +${selected.length - 2}` : "")
      : placeholder
    // Falls back to the raw value (not the placeholder) when it doesn't match
    // any item — e.g. a time picker opened on a value from before this list
    // existed, or before it was snapped to these increments.
    : byId.get(value)?.name || value || placeholder;

  return (
    <div className="relative">
      {label && <label className="text-sm font-medium">{label}</label>}
      <button
        type="button"
        aria-label={ariaLabel || label}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`mt-1 flex w-full items-center justify-between gap-2 rounded-input border border-border bg-surface px-3 py-2 text-left text-sm outline-none transition-colors duration-150 focus:border-primary disabled:opacity-50 ${
          selected.length ? "" : "text-muted"
        }`}
      >
        <span className="flex-1 truncate">{summary}</span>
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
                  <label
                    className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-background ${
                      !multiple && selected.includes(item._id) ? "bg-background" : ""
                    }`}
                  >
                    {multiple && (
                      <input
                        type="checkbox"
                        checked={selected.includes(item._id)}
                        onChange={() => toggle(item._id)}
                        className="accent-primary"
                      />
                    )}
                    {!multiple && (
                      <input
                        type="radio"
                        checked={selected.includes(item._id)}
                        onChange={() => toggle(item._id)}
                        className="accent-primary"
                      />
                    )}
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
