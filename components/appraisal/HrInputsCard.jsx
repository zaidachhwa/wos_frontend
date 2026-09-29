"use client";

import { useState } from "react";

import { Button, Input, Textarea } from "@/components/ui/Field";

// The HR-entered monthly numbers. These — never follow-ups or attendance —
// are what the Leaves and Late Marks criteria score.
export default function HrInputsCard({ appraisal, editable, onSave, saving }) {
  const [draft, setDraft] = useState(null); // null = untouched
  const values = draft ?? {
    leaves: appraisal.hrInputs?.leaves ?? "",
    lateMarks: appraisal.hrInputs?.lateMarks ?? "",
    notes: appraisal.hrInputs?.notes ?? "",
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
