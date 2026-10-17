"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, ArrowUp, Pencil, Plus, Scale, Trash2, CornerDownRight } from "lucide-react";

import AllocationDialog from "@/components/appraisal/settings/AllocationDialog";
import CriterionDialog from "@/components/appraisal/settings/CriterionDialog";
import Badge from "@/components/ui/Badge";
import { Button, Select } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { deleteCriterion, reorderCriteria, fetchPositions } from "@/services/appraisalsService";
import { fetchDepartments } from "@/services/orgService";
import { METHOD_LABELS, TYPE_LABELS, apiError, fmtScore } from "@/lib/appraisal";

const FREQ_COLORS = {
  daily: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  weekly: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  biweekly: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  monthly: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

export default function CriteriaTable({ criteria, weightage, catalog }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: fetchDepartments });
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new
  const [allocation, setAllocation] = useState(null); // null = closed, { focusId }
  const [deptFilter, setDeptFilter] = useState(""); // "" = all criteria
  const [posFilter, setPosFilter] = useState("");

  const { data: positions = [] } = useQuery({
    queryKey: ["appraisal-positions", deptFilter],
    queryFn: () => fetchPositions(deptFilter),
  });

  const deptName = new Map(departments.map((d) => [String(d._id), d.name]));
  const appliesTo = (c) =>
    c.departments?.length
      ? c.departments.map((id) => deptName.get(String(id)) || "Deleted department").join(", ")
      : "All departments";

  const appliesToPositions = (c) =>
    c.positions?.length ? c.positions.join(", ") : "All positions";

  // Filter criteria
  const overrideIn = (c) => (c.departmentWeightages || []).find((o) => String(o.department) === deptFilter);

  const shown = criteria.filter((c) => {
    if (deptFilter && c.departments?.length && !c.departments.map(String).includes(deptFilter)) {
      return false;
    }
    if (posFilter && c.positions?.length && !c.positions.some((p) => p.toLowerCase() === posFilter.toLowerCase())) {
      return false;
    }
    return true;
  });

  const deptStatus = deptFilter ? (weightage.byDepartment || []).find((d) => d.departmentId === deptFilter) : null;
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

  // Build hierarchy: Top-level criteria, followed by their sub-criteria
  const mainCriteria = shown.filter((c) => !c.parentCriterion);
  const subCriteriaMap = new Map();
  for (const c of shown) {
    if (c.parentCriterion) {
      const pid = String(c.parentCriterion?._id || c.parentCriterion);
      if (!subCriteriaMap.has(pid)) subCriteriaMap.set(pid, []);
      subCriteriaMap.get(pid).push(c);
    }
  }

  // Any sub-criteria whose parent is filtered out
  const mainIds = new Set(mainCriteria.map((c) => String(c._id)));
  const orphanSubs = shown.filter((c) => c.parentCriterion && !mainIds.has(String(c.parentCriterion?._id || c.parentCriterion)));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className={`flex items-center gap-2 text-sm font-medium ${weightage.valid ? "text-success" : "text-danger"}`}>
            {!weightage.valid && <AlertTriangle size={15} />}
            {weightage.valid ? "Active top-level criteria total 100%" : "Active criteria weightage must total 100% in every department"}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {(weightage.byDepartment || []).map((d) => (
              <span key={d.departmentId || "none"} className={d.valid ? "text-muted" : "font-medium text-danger"}>
                {d.name}: {d.total}%
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-48">
            <Select label="Department" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d._id} value={String(d._id)}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-48">
            <Select label="Position" value={posFilter} onChange={(e) => setPosFilter(e.target.value)}>
              <option value="">All positions</option>
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="secondary" onClick={() => setAllocation({ scope: deptFilter || undefined })}>
            <Scale size={15} /> Adjust weightage
          </Button>
          <Button onClick={() => setEditing(null)}>
            <Plus size={15} /> Add criterion
          </Button>
        </div>
      </div>

      {deptStatus && (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-2 rounded-card border px-4 py-3 text-sm ${
            deptStatus.valid ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"
          }`}
        >
          <span>
            <span className="font-semibold">{deptStatus.name}</span> — {shown.filter((c) => c.isActive && !c.parentCriterion).length} active main criteria apply, totalling{" "}
            <span className={`font-semibold tabular-nums ${deptStatus.valid ? "text-success" : "text-danger"}`}>{deptStatus.total}%</span>
          </span>
          {!deptStatus.valid && <span className="text-danger">{deptStatus.message} Appraisals here can&apos;t be finalized yet.</span>}
        </div>
      )}

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Criterion & Hierarchy</th>
              <th className="px-4 py-3 font-medium">Frequency</th>
              <th className="px-4 py-3 font-medium">Applicability</th>
              <th className="px-4 py-3 text-right font-medium">
                {deptStatus ? `Weightage (${deptStatus.name})` : "Weightage"}
              </th>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {mainCriteria.length === 0 && orphanSubs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                  No criteria match the selected filters.
                </td>
              </tr>
            )}

            {mainCriteria.map((main, i) => {
              const subs = subCriteriaMap.get(String(main._id)) || [];
              return (
                <CriterionRowGroup
                  key={main._id}
                  main={main}
                  subs={subs}
                  index={i}
                  criteria={criteria}
                  deptFilter={deptFilter}
                  deptStatus={deptStatus}
                  deptName={deptName}
                  overrideIn={overrideIn}
                  appliesTo={appliesTo}
                  appliesToPositions={appliesToPositions}
                  catalog={catalog}
                  move={move}
                  reorder={reorder}
                  setEditing={setEditing}
                  setAllocation={setAllocation}
                  remove={remove}
                />
              );
            })}

            {orphanSubs.map((sub, i) => (
              <CriterionRow
                key={sub._id}
                c={sub}
                isSub
                index={i}
                criteria={criteria}
                deptFilter={deptFilter}
                deptStatus={deptStatus}
                deptName={deptName}
                overrideIn={overrideIn}
                appliesTo={appliesTo}
                appliesToPositions={appliesToPositions}
                catalog={catalog}
                move={move}
                reorder={reorder}
                setEditing={setEditing}
                setAllocation={setAllocation}
                remove={remove}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <p>
          Main criteria weights sum to 100%. Sub-criteria are evaluated under their main criterion at their configured frequency.
        </p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" /> Daily
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-purple-500 inline-block" /> Weekly
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Biweekly
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Monthly
          </span>
        </div>
      </div>

      <CriterionDialog
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        criterion={editing || null}
        catalog={catalog}
        departments={departments}
        criteria={criteria}
      />

      {allocation && (
        <AllocationDialog
          open
          onClose={() => setAllocation(null)}
          focusId={allocation.focusId}
          initialScope={allocation.scope}
          departments={departments}
          appliesTo={appliesTo}
          criteria={criteria.map((c) => (c._id === allocation.focusId ? { ...c, isActive: !c.isActive } : c))}
        />
      )}
    </section>
  );
}

function CriterionRowGroup(props) {
  const { main, subs } = props;
  return (
    <>
      <CriterionRow c={main} isSub={false} subCount={subs.length} {...props} />
      {subs.map((sub, j) => (
        <CriterionRow key={sub._id} c={sub} isSub subIndex={j} subTotal={subs.length} {...props} />
      ))}
    </>
  );
}

function CriterionRow({
  c,
  isSub,
  subCount = 0,
  deptFilter,
  deptStatus,
  deptName,
  overrideIn,
  appliesTo,
  appliesToPositions,
  catalog,
  setEditing,
  setAllocation,
  remove,
}) {
  const freq = c.frequency || "monthly";

  return (
    <tr
      className={`border-b border-border/60 transition-colors last:border-0 ${
        isSub ? "bg-background/40 hover:bg-background/80" : "hover:bg-surface-elevated/40"
      }`}
    >
      <td className="px-4 py-3">
        <div className={`flex items-start gap-2 ${isSub ? "pl-6" : ""}`}>
          {isSub && <CornerDownRight size={15} className="text-muted shrink-0 mt-1" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-medium ${c.isActive ? "" : "text-muted"} ${!isSub ? "text-base font-semibold" : ""}`}>
                {c.name}
              </span>
              {!isSub && subCount > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {subCount} {subCount === 1 ? "sub-criterion" : "sub-criteria"}
                </span>
              )}
              {isSub && (
                <span className="rounded bg-muted/20 px-1.5 py-0.5 text-[10px] uppercase font-semibold text-muted">
                  Sub
                </span>
              )}
            </div>
            <p className="max-w-md truncate text-xs text-muted mt-0.5" title={c.description}>
              {c.metric ? catalog?.metrics?.[c.metric]?.label : c.description || "No description"}
            </p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-btn border px-2 py-0.5 text-xs font-medium capitalize ${FREQ_COLORS[freq] || ""}`}>
          {freq}
        </span>
      </td>

      <td className="max-w-48 px-4 py-3 text-xs">
        <p className={`truncate font-medium ${c.departments?.length ? "" : "text-muted"}`} title={appliesTo(c)}>
          {appliesTo(c)}
        </p>
        <p className={`truncate mt-0.5 ${c.positions?.length ? "text-primary" : "text-muted"}`} title={appliesToPositions(c)}>
          {c.positions?.length ? `Positions: ${appliesToPositions(c)}` : "All positions"}
        </p>
      </td>

      <td className="px-4 py-3 text-right tabular-nums">
        <div className="font-medium">
          {deptFilter ? fmtScore(overrideIn(c)?.weightage ?? c.weightage) : fmtScore(c.weightage)}%
        </div>
        {deptFilter ? (
          <span className={`block text-xs ${overrideIn(c) ? "text-info" : "text-muted"}`}>
            {overrideIn(c) ? `dept-specific` : "default"}
          </span>
        ) : (
          c.departmentWeightages?.length > 0 && (
            <span
              className="block text-xs text-info"
              title={c.departmentWeightages.map((o) => `${deptName.get(String(o.department)) || "Deleted"}: ${o.weightage}%`).join("\n")}
            >
              varies by dept
            </span>
          )
        )}
      </td>

      <td className="px-4 py-3 text-muted text-xs">
        {METHOD_LABELS[c.scoringMethod] || c.scoringMethod}
      </td>

      <td className="px-4 py-3">
        <Badge value={c.isActive ? "Active" : "Inactive"} tone={c.isActive ? "success" : "muted"} />
      </td>

      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)} className="px-2">
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setAllocation({ focusId: c._id, scope: deptFilter || undefined })}
            className="px-2 text-xs"
          >
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
  );
}
