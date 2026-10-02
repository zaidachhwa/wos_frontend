"use client";

import { useState } from "react";

import { Button, Input, Textarea } from "@/components/ui/Field";

// The HR-entered monthly numbers. These — never follow-ups or attendance —
// are what the Leaves and Late Marks criteria score.
// scoreFrom/scoreTo let HR record which date range the performance scores cover.
export default function HrInputsCard({ appraisal, editable, onSave, saving }) {
  const [draft, setDraft] = useState(null); // null = untouched
  const values = draft ?? {
    leaves: appraisal.hrInputs?.leaves ?? "",
    lateMarks: appraisal.hrInputs?.lateMarks ?? "",
    notes: appraisal.hrInputs?.notes ?? "",
    scoreFrom: appraisal.hrInputs?.scoreFrom ? new Date(appraisal.hrInputs.scoreFrom).toISOString().slice(0, 10) : "",
    scoreTo: appraisal.hrInputs?.scoreTo ? new Date(appraisal.hrInputs.scoreTo).toISOString().slice(0, 10) : "",
  };
  const set = (k) => (e) => setDraft({ ...values, [k]: e.target.value });

  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">HR entered metrics</h2>
      <p className="mt-1 text-xs text-muted">Entered by HR for this month. Follow-ups and attendance records are not used.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Input label="Leaves" type="number" min="0" max="31" step="0.5" disabled={!editable} value={values.leaves} onChange={set("leaves")} />
        <Input label="Late marks" type="number" min="0" max="31" step="1" disabled={!editable} value={values.lateMarks} onChange={set("lateMarks")} />
      </div>

      {/* Performance Score Period */}
      <div className="mt-3">
        <p className="mb-1 text-xs font-medium text-muted">Performance score period (optional)</p>
        <p className="mb-2 text-xs text-muted">Specify the date range this performance score covers, if different from the full month.</p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Score From"
            type="date"
            disabled={!editable}
            value={values.scoreFrom}
            onChange={set("scoreFrom")}
          />
          <Input
            label="Score To"
            type="date"
            disabled={!editable}
            value={values.scoreTo}
            onChange={set("scoreTo")}
          />
        </div>
        {/* Display saved period if set */}
        {!editable && (values.scoreFrom || values.scoreTo) && (
          <p className="mt-1 text-xs text-muted">
            Score period: {values.scoreFrom || "—"} → {values.scoreTo || "—"}
          </p>
        )}
      </div>

      {editable && (
        <>
          <div className="mt-3">
            <Textarea label="HR notes (optional)" rows={2} value={values.notes} onChange={set("notes")} />
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              disabled={saving || draft === null}
              onClick={() =>
                onSave({
                  leaves: values.leaves === "" ? null : Number(values.leaves),
                  lateMarks: values.lateMarks === "" ? null : Number(values.lateMarks),
                  notes: values.notes,
                  scoreFrom: values.scoreFrom || "",
                  scoreTo: values.scoreTo || "",
                }).then(() => setDraft(null))
              }
            >
              {saving ? "Saving…" : "Save inputs"}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
