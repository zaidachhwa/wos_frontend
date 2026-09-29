"use client";

import { use } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ShieldAlert } from "lucide-react";

import CriterionLine from "@/components/appraisal/CriterionLine";
import HrInputsCard from "@/components/appraisal/HrInputsCard";
import MetricsPanels from "@/components/appraisal/MetricsPanels";
import ScoreHeader from "@/components/appraisal/ScoreHeader";
import WorkflowActions from "@/components/appraisal/WorkflowActions";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import useToast from "@/hooks/useToast";
import {
  fetchAppraisalDetail,
  finalizeAppraisal,
  recalculateAppraisal,
  reopenAppraisal,
  saveEvaluation,
  saveHrInputs,
  submitAppraisal,
} from "@/services/appraisalsService";
import { apiError, fmtDateTime, fmtScore } from "@/lib/appraisal";

const GROUPS = [
  ["automatic", "Automatic performance"],
  ["hr_metric", "HR entered metrics"],
  ["hr_evaluation", "HR evaluation"],
];

const ACTIONS = {
  recalculate: (id) => recalculateAppraisal(id),
  submit: (id) => submitAppraisal(id),
  finalize: (id) => finalizeAppraisal(id),
  reopen: (id, body) => reopenAppraisal({ id, ...body }),
};
const ACTION_DONE = { recalculate: "Recalculated", submit: "Submitted", finalize: "Appraisal finalized", reopen: "Appraisal reopened" };

export default function AppraisalDetailPage({ params }) {
  const { id } = use(params);
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = ["appraisal-detail", id];
  const { data: a, isLoading, error } = useQuery({ queryKey: key, queryFn: () => fetchAppraisalDetail(id), retry: false });

  const onSuccess = (fresh) => {
    queryClient.setQueryData(key, fresh);
    queryClient.invalidateQueries({ queryKey: ["appraisals"] });
  };
  const onError = (e) => toast.error(apiError(e));

  const action = useMutation({
    mutationFn: ({ name, body }) => ACTIONS[name](id, body),
    onSuccess: (fresh, { name }) => {
      onSuccess(fresh);
      toast.success(ACTION_DONE[name]);
    },
    onError,
  });
  const inputs = useMutation({
    mutationFn: (body) => saveHrInputs({ id, ...body }),
    onSuccess: (fresh) => {
      onSuccess(fresh);
      toast.success("HR inputs saved");
    },
    onError,
  });
  const evaluate = useMutation({ mutationFn: (body) => saveEvaluation({ id, ...body }), onSuccess, onError });

  if (isLoading) return <Skeleton className="mx-auto h-96 max-w-[1200px] rounded-card" />;
  if (error) {
    const forbidden = error.response?.status === 403;
    return (
      <EmptyState
        icon={forbidden ? ShieldAlert : AlertTriangle}
        heading={forbidden ? "Not available" : "Couldn't load this appraisal"}
        description={forbidden ? "You don't have access to this appraisal, or it hasn't been finalized yet." : apiError(error)}
      />
    );
  }

  const canManage = a.canManage;
  const hrView = Boolean(a.criteriaMeta); // admin/hr/director: full calculation detail
  const editable = canManage && a.status !== "finalized";
  const monthEnded = new Date() > new Date(a.periodEnd);
  const metaByKey = new Map((a.criteriaMeta || []).map((c) => [c.key, c]));
  const busy = action.isPending || inputs.isPending || evaluate.isPending;
  const run = (name, body) => action.mutateAsync({ name, body }).catch(() => {});

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={hrView ? `/appraisal?month=${a.month}` : "/appraisal"} className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary">
          <ChevronLeft size={15} /> Appraisals
        </Link>
        {canManage && <WorkflowActions appraisal={a} monthEnded={monthEnded} busy={busy} onAction={run} />}
      </div>

      <ScoreHeader appraisal={a} showHistoryLink={hrView} />

      {canManage && a.missingInputs?.length > 0 && (
        <div role="status" className="flex items-start gap-2 rounded-card border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>Still needed before finalization: {a.missingInputs.join(", ")}.</span>
        </div>
      )}
      {a.status === "reopened" && (
        <p className="text-xs text-muted">Reopened — recalculating with the configuration it was originally finalized under.</p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {GROUPS.map(([group, title]) => {
            const entries = (a.entries || []).filter((e) => (e.group || "automatic") === group);
            if (!entries.length) return null;
            const subtotal = entries.reduce((s, e) => s + e.score, 0);
            const max = entries.reduce((s, e) => s + e.maxScore, 0);
            return (
              <section key={group} className="rounded-card border border-border bg-surface p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
                  <span className="text-sm tabular-nums text-muted">
                    {fmtScore(subtotal)} / {fmtScore(max)}
                  </span>
                </div>
                <ul className="mt-2">
                  {entries.map((e) => (
                    <CriterionLine
                      key={e.criterionKey}
                      entry={e}
                      meta={metaByKey.get(e.criterionKey)}
                      editable={editable}
                      saving={evaluate.isPending}
                      onSave={(body) => evaluate.mutateAsync({ criterionKey: e.criterionKey, ...body }).catch(() => {})}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
          <div className="flex items-center justify-between rounded-card border border-border bg-surface px-5 py-4">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-semibold tabular-nums">{fmtScore(a.totalScore)} / 100</span>
          </div>
        </div>

        <aside className="space-y-6">
          {canManage && <HrInputsCard key={a.hrInputs?.updatedAt || "new"} appraisal={a} editable={editable} saving={inputs.isPending} onSave={(b) => inputs.mutateAsync(b).catch(() => {})} />}
          {a.improvementAreas?.length > 0 && (
            <section className="rounded-card border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold">Areas requiring improvement</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {a.improvementAreas.map((x) => (
                  <li key={x.criterionKey} className="flex justify-between gap-2">
                    <span>{x.name}</span>
                    <span className="tabular-nums text-muted">
                      {fmtScore(x.score)} / {fmtScore(x.maxScore)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {canManage && a.reopenHistory?.length > 0 && (
            <section className="rounded-card border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold">Reopen history</h2>
              <ul className="mt-2 space-y-3 text-xs">
                {a.reopenHistory.map((r) => (
                  <li key={r._id}>
                    <p className="font-medium">
                      {r.by?.name || "HR"} · {fmtDateTime(r.at)}
                    </p>
                    <p className="text-muted">{r.reason}</p>
                    <p>
                      {fmtScore(r.oldScore)} → {r.newScore === null ? "pending" : fmtScore(r.newScore)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {a.calculatedAt && canManage && <p className="text-xs text-muted">Last calculated {fmtDateTime(a.calculatedAt)}</p>}
        </aside>
      </div>

      {hrView && <MetricsPanels metrics={a.metricsSnapshot} />}
    </div>
  );
}
