"use client";

import { Plus } from "lucide-react";

import SettingsSection from "@/components/appraisal/settings/SettingsSection";
import { Button } from "@/components/ui/Field";

const cell = "w-full rounded-input border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary";

// Severity levels and their penalty points. New levels can be added;
// existing ones are deactivated rather than removed (old bugs reference
// them). Finalized appraisals keep the penalties they were finalized with.
export default function BugPenaltiesCard({ settings, bugStatuses }) {
  return (
    <SettingsSection
      title="Bug penalties"
      description="Penalty points per bug severity, and which bug statuses count. Changes apply to appraisals not yet finalized."
      initial={{ bugSeverities: settings.bugSeverities, bugCountableStatuses: settings.bugCountableStatuses }}
      toPayload={(v) => v}
    >
      {(v, set) => {
        const update = (i, patch) => set({ ...v, bugSeverities: v.bugSeverities.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
        const existingKeys = new Set(settings.bugSeverities.map((s) => s.key));
        return (
          <div className="space-y-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 font-medium">Severity</th>
                  <th className="w-32 pb-2 font-medium">Penalty points</th>
                  <th className="w-24 pb-2 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {v.bugSeverities.map((s, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-3">
                      <input aria-label="Severity label" className={cell} value={s.label} onChange={(e) => update(i, { label: e.target.value, ...(existingKeys.has(s.key) ? {} : { key: "" }) })} />
                    </td>
                    <td className="py-1 pr-3">
                      <input aria-label={`${s.label} penalty`} type="number" min="0" step="0.5" className={cell} value={s.penalty} onChange={(e) => update(i, { penalty: e.target.value })} />
                    </td>
                    <td className="py-1">
                      <input type="checkbox" aria-label={`${s.label} active`} checked={s.isActive !== false} onChange={(e) => update(i, { isActive: e.target.checked })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button variant="secondary" onClick={() => set({ ...v, bugSeverities: [...v.bugSeverities, { key: "", label: "", penalty: 0, isActive: true }] })}>
              <Plus size={15} /> Add severity level
            </Button>
            <fieldset>
              <legend className="text-sm font-medium">Bug statuses that count toward the penalty</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {bugStatuses.map((st) => (
                  <label key={st} className="flex items-center gap-2 text-sm capitalize">
                    <input
                      type="checkbox"
                      checked={v.bugCountableStatuses.includes(st)}
                      onChange={(e) =>
                        set({ ...v, bugCountableStatuses: e.target.checked ? [...v.bugCountableStatuses, st] : v.bugCountableStatuses.filter((x) => x !== st) })
                      }
                    />
                    {st}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        );
      }}
    </SettingsSection>
  );
}
