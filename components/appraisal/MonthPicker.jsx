"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { currentIstMonth, monthLabel, shiftMonth } from "@/lib/appraisal";

// Month stepper, IST-based. Can't step past the current month — the
// backend refuses future appraisal months anyway.
export default function MonthPicker({ month, onChange }) {
  const atCurrent = month >= currentIstMonth();
  const btn = "rounded-btn border border-border p-2 text-muted hover:bg-background hover:text-primary disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Previous month" className={btn}>
        <ChevronLeft size={16} />
      </button>
      <p className="min-w-40 text-center text-sm font-medium">{monthLabel(month)}</p>
      <button type="button" onClick={() => onChange(shiftMonth(month, 1))} aria-label="Next month" disabled={atCurrent} className={btn}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
