"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import Dialog from "@/components/ui/Dialog";
import { Button, Select } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { saveAllocation } from "@/services/appraisalsService";
import { apiError } from "@/lib/appraisal";

const DEFAULT_SCOPE = "__default";
const sumOf = (list) => list.reduce((s, w) => s + Math.round(Number(w || 0) * 100), 0) / 100;
const applies = (item, deptId) => !item.departments.length || (deptId && item.departments.includes(deptId));
// A department's weightage for an item: its override if set, else the default.
const hasOverride = (item, deptId) => Boolean(deptId) && item.overrides[deptId] !== undefined && item.overrides[deptId] !== "";
const weightFor = (item, deptId) => (hasOverride(item, deptId) ? item.overrides[deptId] : item.weightage);

// Rebalance weightage and activation in one atomic save. "Weightage for"
// switches between the default weightage and any one department's own
// weightage (an override; blank = use the default). The server rejects the
// save unless every department totals exactly 100%; the totals here are a
// live guide.
export default function AllocationDialog({ open, onClose, criteria, focusId, initialScope, departments = [], appliesTo }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState(null);
  const [scope, setScope] = useState(initialScope || DEFAULT_SCOPE);
  const [error, setError] = useState("");
  const items =
    rows ??
    criteria.map((c) => ({
      id: c._id,
      name: c.name,
      weightage: c.weightage,
      isActive: c.isActive,
      departments: (c.departments || []).map(String),
      overrides: Object.fromEntries((c.departmentWeightages || []).map((o) => [String(o.department), o.weightage])),
      label: appliesTo ? appliesTo(c) : "All departments",
      focus: c._id === focusId,
    }));
  const deptId = scope === DEFAULT_SCOPE ? null : scope;
  const active = items.filter((i) => i.isActive);
  const totals = departments.length
    ? departments.map((d) => ({
        id: String(d._id),
        name: d.name,
        total: sumOf(active.filter((i) => applies(i, String(d._id))).map((i) => weightFor(i, String(d._id)))),
      }))
    : [{ id: null, name: "All departments", total: sumOf(active.filter((i) => !i.departments.length).map((i) => i.weightage)) }];
  const allValid = totals.every((t) => t.total === 100);
  const visible = items.filter((i) => applies(i, deptId) || !deptId);

  const close = () => {
    setRows(null);
    setScope(DEFAULT_SCOPE);
    setError("");
    onClose();
  };
  const save = useMutation({
    mutationFn: () =>
      saveAllocation(
        items.map((i) => ({
          id: i.id,
          isActive: i.isActive,
          weightage: Number(i.weightage),
          departmentWeightages: Object.entries(i.overrides)
            .filter(([, w]) => w !== "" && w !== undefined)
            .map(([department, weightage]) => ({ department, weightage: Number(weightage) })),
        }))
      ),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["appraisal-settings"] });
      queryClient.invalidateQueries({ queryKey: ["appraisals"] });
      if (res.data?.weightage?.valid === false) toast.info(res.message);
      else toast.success("Weightage saved");
      close();
    },
    onError: (e) => setError(apiError(e)),
  });
  const update = (id, patch) => setRows(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const setWeight = (item, value) => {
    if (!deptId) update(item.id, { weightage: value });
    else update(item.id, { overrides: { ...item.overrides, [deptId]: value } });
  };
  const resetOverride = (item) => {
    const overrides = { ...item.overrides };
    delete overrides[deptId];
    update(item.id, { overrides });
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Adjust weightage & activation"
      footer={
        <>
          <span className={`mr-auto self-center text-sm font-semibold ${allValid ? "text-success" : "text-warning"}`}>
            {allValid ? "Every department = 100%" : "Not 100% yet — you can save and finish later"}
          </span>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <p className="mb-3 text-sm text-muted">
        You can save in steps — for example, reduce existing criteria now and add new ones afterwards. A department&apos;s appraisals can only be
        finalized once its active criteria total exactly 100%. Finalized appraisals keep the weightage they were finalized with.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {totals.map((t) => (
          <button
            type="button"
            key={t.name}
            onClick={() => t.id && setScope(t.id)}
            className={`rounded-btn border px-3 py-2 text-left text-sm ${t.total === 100 ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"} ${
              scope === t.id ? "ring-2 ring-primary/40" : ""
            }`}
          >
            <p className="truncate text-xs text-muted">{t.name}</p>
            <p className={`font-semibold tabular-nums ${t.total === 100 ? "text-success" : "text-danger"}`}>{t.total}%</p>
          </button>
        ))}
      </div>

      {departments.length > 0 && (
        <div className="mb-3 max-w-xs">
          <Select label="Weightage for" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value={DEFAULT_SCOPE}>Default (all departments)</option>
            {departments.map((d) => (
              <option key={d._id} value={String(d._id)}>
                {d.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted">
            {deptId
              ? "Values here apply to this department only. Clear a value to fall back to the default."
              : "The default applies to every department that doesn't have its own value."}
          </p>
        </div>
      )}

      <ul className="divide-y divide-border/60">
        {visible.map((i) => {
          const overridden = hasOverride(i, deptId);
          return (
            <li key={i.id} className={`flex items-center gap-3 py-2 ${i.focus ? "bg-info/5" : ""}`}>
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <input type="checkbox" checked={i.isActive} onChange={(e) => update(i.id, { isActive: e.target.checked })} />
                <span className={`min-w-0 ${i.isActive ? "" : "text-muted line-through"}`}>
                  {i.name}
                  <span className="block truncate text-xs text-muted no-underline">
                    {i.label}
                    {!deptId && Object.keys(i.overrides).length > 0 && " · has department-specific weightage"}
                  </span>
                </span>
              </label>
              {overridden && (
                <button type="button" onClick={() => resetOverride(i)} className="text-xs text-info hover:underline">
                  Use default ({i.weightage}%)
                </button>
              )}
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                aria-label={`${i.name} weightage`}
                placeholder={deptId ? String(i.weightage) : undefined}
                value={deptId ? (i.overrides[deptId] ?? "") : i.weightage}
                onChange={(e) => setWeight(i, e.target.value)}
                className={`w-24 rounded-input border bg-surface px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-primary ${
                  overridden ? "border-info" : "border-border"
                }`}
              />
              <span className="text-sm text-muted">%</span>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
