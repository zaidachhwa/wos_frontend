"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, ArrowUp, Pencil, Plus, Scale, Trash2 } from "lucide-react";

import AllocationDialog from "@/components/appraisal/settings/AllocationDialog";
import CriterionDialog from "@/components/appraisal/settings/CriterionDialog";
import Badge from "@/components/ui/Badge";
import { Button } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { deleteCriterion, reorderCriteria } from "@/services/appraisalsService";
import { METHOD_LABELS, TYPE_LABELS, apiError, fmtScore } from "@/lib/appraisal";

export default function CriteriaTable({ criteria, weightage, catalog }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new
  const [allocation, setAllocation] = useState(null); // null = closed, { focusId }
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["appraisal-settings"] });

  const reorder = useMutation({ mutationFn: reorderCriteria, onSuccess: refresh, onError: (e) => toast.error(apiError(e)) });
  const remove = useMutation({
    mutationFn: deleteCriterion,
    onSuccess: () => {
      refresh();
      toast.success("Criterion deleted");
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const move = (index, delta) => {
    const ids = criteria.map((c) => c._id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id);
    reorder.mutate(ids);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`flex items-center gap-2 text-sm font-medium ${weightage.valid ? "text-success" : "text-danger"}`}>
          {!weightage.valid && <AlertTriangle size={15} />}
          Active weightage: {weightage.total}% {weightage.valid ? "— valid" : `— ${weightage.message}`}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setAllocation({})}>
            <Scale size={15} /> Adjust weightage
          </Button>
          <Button onClick={() => setEditing(null)}>
            <Plus size={15} /> Add criterion
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Criterion</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Weightage</th>
              <th className="px-4 py-3 font-medium">Scoring method</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c, i) => (
              <tr key={c._id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <p className={`font-medium ${c.isActive ? "" : "text-muted"}`}>{c.name}</p>
                  <p className="max-w-md truncate text-xs text-muted" title={c.description}>
                    {c.metric ? catalog?.metrics?.[c.metric]?.label : c.description}
                  </p>
                </td>
                <td className="px-4 py-3">{TYPE_LABELS[c.type]}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtScore(c.weightage)}%</td>
                <td className="px-4 py-3 text-muted">{METHOD_LABELS[c.scoringMethod]}</td>
                <td className="px-4 py-3">
                  <Badge value={c.isActive ? "Active" : "Inactive"} tone={c.isActive ? "success" : "muted"} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" aria-label="Move up" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} className="px-2">
                      <ArrowUp size={14} />
                    </Button>
                    <Button variant="ghost" aria-label="Move down" disabled={i === criteria.length - 1 || reorder.isPending} onClick={() => move(i, 1)} className="px-2">
                      <ArrowDown size={14} />
                    </Button>
                    <Button variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)} className="px-2">
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" onClick={() => setAllocation({ focusId: c._id })} className="px-2 text-xs">
                      {c.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    {!c.isActive && !c.usedInFinalized && (
                      <Button
                        variant="ghost"
                        aria-label={`Delete ${c.name}`}
                        className="px-2 text-danger"
                        onClick={() => window.confirm(`Permanently delete "${c.name}"?`) && remove.mutate(c._id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Criteria used in a finalized appraisal can only be deactivated, never deleted. Activating or deactivating opens the weightage dialog so
        the active total stays at 100%.
      </p>

      <CriterionDialog open={editing !== undefined} onClose={() => setEditing(undefined)} criterion={editing || null} catalog={catalog} />
      {allocation && (
        <AllocationDialog
          open
          onClose={() => setAllocation(null)}
          focusId={allocation.focusId}
          criteria={criteria.map((c) => (c._id === allocation.focusId ? { ...c, isActive: !c.isActive } : c))}
        />
      )}
    </section>
  );
}
