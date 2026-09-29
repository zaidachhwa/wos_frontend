"use client";

import { useState } from "react";

import { Button, Input, Textarea } from "@/components/ui/Field";

// HR controls under a criterion: pick exactly one rating (manual), or
// adjust the system percentage with a mandatory reason (hybrid). Optional
// comment/evidence either way. Saves go to the backend, which rescored.
export default function CriterionEvaluation({ entry, meta, onSave, saving }) {
  const [comment, setComment] = useState(null); // null = untouched
  const [override, setOverride] = useState(null);
  const [reason, setReason] = useState(null);
  const commentValue = comment ?? entry.comment ?? "";

  if (entry.type === "manual") {
    return (
      <div className="mt-3 space-y-2">
        <div role="radiogroup" aria-label={`${entry.name} rating`} className="flex flex-wrap gap-2">
          {(meta?.ratingOptions || []).map((o) => {
            const selected = entry.ratingKey === o.key;
            return (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={saving}
                onClick={() => onSave({ ratingKey: o.key })}
                className={`rounded-btn border px-3 py-1.5 text-sm font-medium transition-colors duration-150 disabled:opacity-50 ${
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted hover:text-primary"
                }`}
              >
                {o.label} <span className="text-xs opacity-70">({Number(o.pct).toFixed(2)}%)</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Textarea rows={2} placeholder="Comment / evidence (optional)" value={commentValue} onChange={(e) => setComment(e.target.value)} />
          </div>
          {comment !== null && comment !== (entry.comment || "") && (
            <Button variant="secondary" disabled={saving} onClick={() => onSave({ comment }).then(() => setComment(null))}>
              Save note
            </Button>
          )}
        </div>
      </div>
    );
  }

  // hybrid
  const overrideValue = override ?? (entry.overridePct ?? "");
  const reasonValue = reason ?? entry.overrideReason ?? "";
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 rounded-btn border border-border bg-background p-3 sm:grid-cols-[140px_1fr_auto]">
      <Input label="Adjusted %" type="number" min="0" max="100" step="0.01" value={overrideValue} onChange={(e) => setOverride(e.target.value)} />
      <Input label="Reason (required)" value={reasonValue} onChange={(e) => setReason(e.target.value)} />
      <div className="flex items-end gap-2">
        <Button
          variant="secondary"
          disabled={saving || overrideValue === ""}
          onClick={() => onSave({ overridePct: Number(overrideValue), overrideReason: reasonValue }).then(() => setOverride(null))}
        >
          Apply
        </Button>
        {entry.overridePct !== null && entry.overridePct !== undefined && (
          <Button variant="ghost" disabled={saving} onClick={() => onSave({ overridePct: null }).then(() => setOverride(null))}>
            Use system
          </Button>
        )}
      </div>
    </div>
  );
}
