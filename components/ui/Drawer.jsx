"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import useLiquidGlass from "@/hooks/useLiquidGlass";

export default function Drawer({ open, onClose, title, children, wide = false }) {
  const panelRef = useRef(null);
  useLiquidGlass(panelRef, { scale: -90, chroma: 6, blur: 10, saturate: 1.5 });

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/30 animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-label={title}
        className={`glass-panel absolute right-0 top-0 flex h-full w-full flex-col border-l border-border animate-[slideInRight_200ms_ease-out] ${
          wide ? "max-w-2xl" : "max-w-md"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-btn p-1.5 text-muted transition-colors duration-150 hover:bg-background hover:text-primary"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </aside>
    </div>
  );
}
