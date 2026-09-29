"use client";

import { Plus } from "lucide-react";

import SettingsSection from "@/components/appraisal/settings/SettingsSection";
import { Button } from "@/components/ui/Field";

const cell = "w-full rounded-input border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary";

// Why a client change happened, and whether that reason is the employee's
// fault. Only "counts against employee" categories reduce the score.
export default function ClientCategoriesCard({ settings }) {
  return (
    <SettingsSection
      title="Client change categories"
      description="HR categorizes each client change (Appraisal → Monthly inputs → Client changes). Only categories that count against the employee reduce the score."
      initial={{ clientChangeCategories: settings.clientChangeCategories, uncategorizedClientChangeCounts: settings.uncategorizedClientChangeCounts }}
      toPayload={(v) => v}
    >
      {(v, set) => {
        const update = (i, patch) => set({ ...v, clientChangeCategories: v.clientChangeCategories.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
        return (
          <div className="space-y-4">
            <ul className="space-y-2">
              {v.clientChangeCategories.map((c, i) => (
                <li key={i} className="flex items-center gap-3">
                  <input aria-label="Category label" className={cell} value={c.label} onChange={(e) => update(i, { label: e.target.value })} />
                  <label className="flex shrink-0 items-center gap-2 text-sm">
                    <input type="checkbox" checked={c.countsAgainstEmployee} onChange={(e) => update(i, { countsAgainstEmployee: e.target.checked })} />
                    Counts against employee
                  </label>
                </li>
              ))}
            </ul>
            <Button variant="secondary" onClick={() => set({ ...v, clientChangeCategories: [...v.clientChangeCategories, { key: "", label: "", countsAgainstEmployee: false }] })}>
              <Plus size={15} /> Add category
            </Button>
            <label className="flex items-center gap-2 border-t border-border pt-4 text-sm">
              <input type="checkbox" checked={v.uncategorizedClientChangeCounts} onChange={(e) => set({ ...v, uncategorizedClientChangeCounts: e.target.checked })} />
              Count client changes HR hasn&apos;t categorized yet against the employee
            </label>
          </div>
        );
      }}
    </SettingsSection>
  );
}
