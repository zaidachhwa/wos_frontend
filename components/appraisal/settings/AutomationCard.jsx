"use client";

import SettingsSection from "@/components/appraisal/settings/SettingsSection";
import { Input, Select } from "@/components/ui/Field";

const APPRAISABLE_ROLES = ["member", "qa", "sublead", "manager", "subadmin", "director", "hr"];

// Month-close behaviour and who gets appraised.
export default function AutomationCard({ settings }) {
  return (
    <SettingsSection
      title="Monthly automation"
      description="At 00:01 IST on the 1st, the previous month is closed and finalized appraisals are emailed to employees."
      initial={{ automation: settings.automation, appraisedRoles: settings.appraisedRoles }}
      toPayload={(v) => ({ ...v, automation: { ...v.automation, maxEmailAttempts: Number(v.automation.maxEmailAttempts) } })}
    >
      {(v, set) => {
        const a = v.automation;
        const setA = (patch) => set({ ...v, automation: { ...a, ...patch } });
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select label="At month close, auto-finalize" value={a.autoFinalizeMode} onChange={(e) => setA({ autoFinalizeMode: e.target.value })}>
                <option value="complete">Every complete appraisal</option>
                <option value="submitted">Only appraisals HR submitted</option>
                <option value="off">Nothing (HR finalizes manually)</option>
              </Select>
              <Select label="Employee emails" value={String(a.emailsEnabled)} onChange={(e) => setA({ emailsEnabled: e.target.value === "true" })}>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </Select>
              <Input label="Max send attempts" type="number" min="1" max="10" value={a.maxEmailAttempts} onChange={(e) => setA({ maxEmailAttempts: e.target.value })} />
            </div>
            <p className="text-xs text-muted">
              Incomplete appraisals are never auto-finalized. They&apos;re emailed as soon as HR finalizes them after the month ends.
            </p>
            <fieldset>
              <legend className="text-sm font-medium">Roles that receive a monthly appraisal</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {APPRAISABLE_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm capitalize">
                    <input
                      type="checkbox"
                      checked={v.appraisedRoles.includes(r)}
                      onChange={(e) => set({ ...v, appraisedRoles: e.target.checked ? [...v.appraisedRoles, r] : v.appraisedRoles.filter((x) => x !== r) })}
                    />
                    {r}
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
