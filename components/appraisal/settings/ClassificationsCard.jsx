"use client";

import { Plus, Trash2 } from "lucide-react";

import SettingsSection from "@/components/appraisal/settings/SettingsSection";
import { Button, Input, Select, Textarea } from "@/components/ui/Field";

const TONES = ["danger", "warning", "success", "info", "muted"];

// HR → Appraisal Settings → Performance Classification. Bands must tile
// 0–100 with no gaps or overlaps (validated server-side); each carries the
// message used in that month's employee email.
export default function ClassificationsCard({ settings }) {
  return (
    <SettingsSection
      title="Performance classification"
      description="Score ranges and labels. Scores are rounded to the configured precision before matching a range."
      initial={{
        classifications: settings.classifications,
        classificationDecimals: settings.classificationDecimals,
        improvementRule: settings.improvementRule,
      }}
      toPayload={(v) => v}
    >
      {(v, set) => {
        const update = (i, patch) => set({ ...v, classifications: v.classifications.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
        return (
          <div className="space-y-4">
            {v.classifications.map((c, i) => (
              <div key={i} className="space-y-3 rounded-btn border border-border p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_90px_90px_120px_auto]">
                  <Input label="Label" value={c.label} onChange={(e) => update(i, { label: e.target.value })} />
                  <Input label="From" type="number" value={c.min} onChange={(e) => update(i, { min: e.target.value })} />
                  <Input label="To" type="number" value={c.max} onChange={(e) => update(i, { max: e.target.value })} />
                  <Select label="Colour" value={c.tone} onChange={(e) => update(i, { tone: e.target.value })}>
                    {TONES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      aria-label="Remove classification"
                      disabled={v.classifications.length < 2}
                      onClick={() => set({ ...v, classifications: v.classifications.filter((_, j) => j !== i) })}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
                <Textarea label="Email message" rows={2} value={c.emailMessage} onChange={(e) => update(i, { emailMessage: e.target.value })} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(c.showImprovementAreas)} onChange={(e) => update(i, { showImprovementAreas: e.target.checked })} />
                  List improvement areas in the email
                </label>
              </div>
            ))}
            <Button
              variant="secondary"
              onClick={() => set({ ...v, classifications: [...v.classifications, { key: "", label: "", min: 0, max: 0, tone: "muted", emailMessage: "", showImprovementAreas: false }] })}
            >
              <Plus size={15} /> Add classification
            </Button>
            <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
              <Select label="Range precision" value={v.classificationDecimals} onChange={(e) => set({ ...v, classificationDecimals: Number(e.target.value) })}>
                <option value={0}>Whole numbers (0–35, 36–75…)</option>
                <option value={1}>1 decimal</option>
                <option value={2}>2 decimals</option>
              </Select>
              <Input
                label="Improvement area: below % of criterion"
                type="number"
                min="0"
                max="100"
                value={v.improvementRule.thresholdPct}
                onChange={(e) => set({ ...v, improvementRule: { ...v.improvementRule, thresholdPct: Number(e.target.value) } })}
              />
              <Input
                label="Max improvement areas listed"
                type="number"
                min="1"
                max="10"
                value={v.improvementRule.maxItems}
                onChange={(e) => set({ ...v, improvementRule: { ...v.improvementRule, maxItems: Number(e.target.value) } })}
              />
            </div>
          </div>
        );
      }}
    </SettingsSection>
  );
}
