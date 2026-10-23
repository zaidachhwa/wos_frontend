"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import Badge from "@/components/ui/Badge";
import { TYPE_LABELS, fmtPct, fmtScore } from "@/lib/appraisal";
import CriterionEvaluation from "@/components/appraisal/CriterionEvaluation";

// One criterion: score / max, rating, and (for HR) the exact calculation
// steps the backend engine recorded, plus the rating/adjustment controls
// while the appraisal is editable.
export default function CriterionLine({ entry, meta, editable, onSave, saving }) {
  const [open, setOpen] = useState(false);
  const hasSteps = Boolean(entry.steps?.length);
  const pct = entry.maxScore ? Math.min(100, (entry.score / entry.maxScore) * 100) : 0;
  const barTone = entry.performancePct === null ? "bg-border" : pct >= 75 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-danger";

  return (
    <li className={`border-b border-border/60 py-3 last:border-0 ${entry.parentKey ? "ml-6 border-l-2 border-l-border pl-4" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-48 flex-1">
          <p className="font-medium">
            {entry.parentKey && <span className="text-primary">↳ </span>}
            {entry.name}
          </p>
          <p className="text-xs text-muted">
            {entry.hasSubCriteria
              ? `Sum of sub-criteria below · weightage ${fmtScore(entry.weightage)}%`
              : entry.parentKey
                ? `${TYPE_LABELS[entry.type]} · sub-criterion · ${fmtScore(entry.weightage)} pts of main`
                : `${TYPE_LABELS[entry.type]} · weightage ${fmtScore(entry.weightage)}%`}
            {entry.periods?.length > 0 && ` · rated ${entry.frequency}`}
            {entry.noData && " · no data this month"}
          </p>
        </div>
        {entry.ratingLabel && <Badge value={entry.ratingLabel} tone="info" />}
        {entry.complete === false && <Badge value={entry.hasSubCriteria ? "Sub-criteria pending" : "Needs input"} tone="warning" />}
        <div className="w-40">
          <p className="text-right text-sm font-semibold tabular-nums">
            {fmtScore(entry.score)} / {fmtScore(entry.maxScore)}
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border/60">
            <div className={`h-full rounded-full ${barTone}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        {hasSteps && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-xs font-medium text-info hover:underline"
          >
            View calculation {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      {open && hasSteps && (
        <div className="mt-3 rounded-btn border border-border bg-background p-3 text-xs">
          <ol className="list-decimal space-y-1 pl-4">
            {entry.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <p className="mt-2 text-muted">
            Source: {entry.source || "—"} · Performance {fmtPct(entry.performancePct)}
          </p>
        </div>
      )}

      {editable && entry.type !== "automatic" && !entry.hasSubCriteria && <CriterionEvaluation entry={entry} meta={meta} onSave={onSave} saving={saving} />}
      {!editable && entry.periods?.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {entry.periods.map((p) => (
            <li key={p.startDate} className="rounded-btn border border-border px-2 py-0.5">
              {p.label?.split(" (")[0] || p.startDate}: <span className="font-medium">{p.ratingLabel || "—"}</span>
            </li>
          ))}
        </ul>
      )}
      {!editable && entry.comment && <p className="mt-2 text-xs text-muted">HR note: {entry.comment}</p>}
    </li>
  );
}
