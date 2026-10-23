"use client";

import { Plus } from "lucide-react";

const RATING_TONES = {
  good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  average: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  poor: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const shortDate = (ymd) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });

// One tile per evaluation slot of the month (each week of a weekly/monthly
// criterion, each fortnight of a biweekly one): which dates it covers, the
// mark given, and how the month's average was worked out.
export default function PeriodMarks({ criterion, onMark, compact = false }) {
  const periods = criterion.periods || [];
  if (!periods.length) return null;

  return (
    <div className="space-y-2">
      <div className={`grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-5"}`}>
        {periods.map((p) => {
          const ev = p.evaluation;
          const title = p.label?.split(" (")[0] || p.startDate;
          return (
            <div
              key={p.startDate}
              className={`rounded-btn border p-2 text-[11px] ${ev ? RATING_TONES[ev.rating] || "border-border" : "border-dashed border-border bg-background/40"}`}
            >
              <p className="font-semibold text-foreground">{title}</p>
              <p className="text-muted">
                {p.startDate === p.endDate ? shortDate(p.startDate) : `${shortDate(p.startDate)} – ${shortDate(p.endDate)}`}
              </p>
              {ev ? (
                <p className="mt-1 font-medium capitalize" title={ev.comment || undefined}>
                  {ev.rating} · {ev.numericScore}%
                  {ev.evaluator?.name && <span className="block font-normal normal-case text-muted">by {ev.evaluator.name}</span>}
                </p>
              ) : onMark ? (
                <button
                  type="button"
                  onClick={() => onMark(p.startDate)}
                  className="mt-1 inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                >
                  <Plus size={11} /> Mark
                </button>
              ) : (
                <p className="mt-1 text-muted">Not marked</p>
              )}
            </div>
          );
        })}
      </div>
      {criterion.averageCalc && <p className="text-[11px] text-muted">{criterion.averageCalc}</p>}
    </div>
  );
}
