"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import useLiquidGlass from "@/hooks/useLiquidGlass";

// Native <dialog> gives focus trap + ESC-to-close for free.
export default function Dialog({ open, onClose, title, children, footer }) {
  const ref = useRef(null);
  useLiquidGlass(ref, { scale: -60, chroma: 4, blur: 6, saturate: 1.4 });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="glass-panel m-auto w-[calc(100%-2rem)] max-w-[720px] rounded-dialog border border-border p-0 text-primary backdrop:bg-black/30"
    >
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="rounded-btn p-1.5 text-muted transition-colors duration-150 hover:bg-background hover:text-primary"
        >
          <X size={18} />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-6 py-4">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
    </dialog>
  );
}
