"use client";

import { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

import { useToastStore } from "@/store/toastStore";

const TONES = {
  success: { icon: CheckCircle2, className: "text-success" },
  danger: { icon: AlertCircle, className: "text-danger" },
  info: { icon: Info, className: "text-info" },
};

function ToastItem({ id, tone, message, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), 4000);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  const { icon: Icon, className } = TONES[tone] || TONES.info;

  return (
    <div
      role="status"
      className="flex w-80 items-start gap-2.5 rounded-card border border-border bg-surface px-4 py-3 text-sm shadow-lg animate-[fadeIn_150ms_ease-out]"
    >
      <Icon size={17} className={`mt-0.5 shrink-0 ${className}`} />
      <p className="flex-1 leading-snug">{message}</p>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        className="shrink-0 text-muted transition-colors duration-150 hover:text-primary"
      >
        <X size={15} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onDismiss={dismiss} />
      ))}
    </div>
  );
}
