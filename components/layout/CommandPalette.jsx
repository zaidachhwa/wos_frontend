"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, FolderKanban, CheckSquare, User } from "lucide-react";

import axiosInstance from "@/services/axiosInstance";

const search = async (q) => {
  const { data } = await axiosInstance.get("/search", { params: { q } });
  return data.data;
};

export default function CommandPalette({ open, onClose }) {
  const router = useRouter();
  const dialogRef = useRef(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setQuery("");
      setDebounced("");
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const { data } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => search(debounced),
    enabled: open && debounced.length >= 2,
  });

  const go = (href) => {
    onClose();
    router.push(href);
  };

  const groups = [
    {
      label: "Projects",
      icon: FolderKanban,
      items: (data?.projects || []).map((p) => ({ key: p._id, text: p.name, hint: p.status, href: `/projects/${p._id}` })),
    },
    {
      label: "Tasks",
      icon: CheckSquare,
      items: (data?.tasks || []).map((t) => ({ key: t._id, text: t.title, hint: t.status?.replace("_", " "), href: "/tasks" })),
    },
    {
      label: "People",
      icon: User,
      items: (data?.users || []).map((u) => ({ key: u._id, text: u.name, hint: u.designation || u.role, href: "/team" })),
    },
  ].filter((g) => g.items.length);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl rounded-dialog border border-border bg-surface p-0 text-primary shadow-lg backdrop:bg-black/30"
    >
      <div className="flex items-center gap-2 border-b border-border px-4">
        <Search size={16} className="text-muted" />
        <input
          autoFocus
          aria-label="Search everything"
          placeholder="Search projects, tasks, people…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent py-3 text-sm outline-none"
        />
        <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd>
      </div>

      <div className="max-h-80 overflow-y-auto p-2">
        {debounced.length < 2 ? (
          <p className="px-3 py-6 text-center text-sm text-muted">Type at least 2 characters…</p>
        ) : groups.length ? (
          groups.map((g) => (
            <div key={g.label}>
              <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {g.label}
              </p>
              {g.items.map((item) => (
                <button
                  key={item.key}
                  onClick={() => go(item.href)}
                  className="flex w-full items-center gap-2 rounded-btn px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-background"
                >
                  <g.icon size={15} className="shrink-0 text-muted" />
                  <span className="truncate">{item.text}</span>
                  <span className="ml-auto shrink-0 text-xs capitalize text-muted">{item.hint}</span>
                </button>
              ))}
            </div>
          ))
        ) : (
          <p className="px-3 py-6 text-center text-sm text-muted">No matches.</p>
        )}
      </div>
    </dialog>
  );
}
