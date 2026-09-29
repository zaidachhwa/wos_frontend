"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import Dialog from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { saveAllocation } from "@/services/appraisalsService";
import { apiError } from "@/lib/appraisal";

// Rebalance weightage and activate/deactivate criteria in one atomic save.
// The server rejects anything but exactly 100% across active criteria; the
// running total here is only a guide.
export default function AllocationDialog({ open, onClose, criteria, focusId }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const items = rows ?? criteria.map((c) => ({ id: c._id, name: c.name, weightage: c.weightage, isActive: c.isActive, focus: c._id === focusId }));
  const total = items.filter((i) => i.isActive).reduce((s, i) => s + Math.round(Number(i.weightage || 0) * 100), 0) / 100;

  const close = () => {
    setRows(null);
    setError("");
    onClose();
  };
  const save = useMutation({
    mutationFn: () => saveAllocation(items.map(({ id, weightage, isActive }) => ({ id, weightage: Number(weightage), isActive }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appraisal-settings"] });
      queryClient.invalidateQueries({ queryKey: ["appraisals"] });
      toast.success("Weightage saved");
      close();
    },
    onError: (e) => setError(apiError(e)),
  });
  const update = (id, patch) => setRows(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Adjust weightage & activation"
      footer={
        <>
          <span className={`mr-auto self-center text-sm font-semibold tabular-nums ${total === 100 ? "text-success" : "text-danger"}`}>
            Active total: {total}%
          </span>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button disabled={save.isPending || total !== 100} onClick={() => save.mutate()}>
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
      <p className="mb-3 text-sm text-muted">Active criteria must total exactly 100%. Finalized appraisals keep the weightage they were finalized with.</p>
      <ul className="divide-y divide-border/60">
        {items.map((i) => (
          <li key={i.id} className={`flex items-center gap-3 py-2 ${i.focus ? "bg-info/5" : ""}`}>
            <label className="flex flex-1 items-center gap-2 text-sm">
              <input type="checkbox" checked={i.isActive} onChange={(e) => update(i.id, { isActive: e.target.checked })} />
              <span className={i.isActive ? "" : "text-muted line-through"}>{i.name}</span>
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              aria-label={`${i.name} weightage`}
              value={i.weightage}
              onChange={(e) => update(i.id, { weightage: e.target.value })}
              className="w-24 rounded-input border border-border bg-surface px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-primary"
            />
            <span className="text-sm text-muted">%</span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
