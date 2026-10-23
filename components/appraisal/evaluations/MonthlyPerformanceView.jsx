"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Plus,
  ThumbsDown,
  Minus,
  ThumbsUp,
  User,
  Calendar,
  FileText,
} from "lucide-react";

import MonthPicker from "@/components/appraisal/MonthPicker";
import PeriodMarks from "@/components/appraisal/evaluations/PeriodMarks";
import Badge from "@/components/ui/Badge";
import { Button, Select } from "@/components/ui/Field";
import EmptyState from "@/components/ui/EmptyState";
import {
  fetchEvaluatableEmployees,
  fetchMonthlyPerformanceBreakdown,
} from "@/services/appraisalsService";
import { currentIstMonth, fmtScore, monthLabel, positionLabel } from "@/lib/appraisal";

const FREQ_COLORS = {
  daily: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  weekly: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  biweekly: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  monthly: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

export default function MonthlyPerformanceView({
  initialEmployeeId = "",
  initialMonth = "",
  onRecordEvaluation,
}) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId);
  const [month, setMonth] = useState(initialMonth || currentIstMonth());
  const [expandedCriteria, setExpandedCriteria] = useState(new Set());
  const [selectedEvaluationDetail, setSelectedEvaluationDetail] = useState(null);

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["evaluatable-employees"],
    queryFn: fetchEvaluatableEmployees,
  });

  const activeEmployeeId = selectedEmployeeId || (employees.length > 0 ? employees[0]._id : "");

  const {
    data: breakdown,
    isLoading: loadingBreakdown,
    error: breakdownError,
  } = useQuery({
    queryKey: ["monthly-performance-breakdown", activeEmployeeId, month],
    queryFn: () =>
      fetchMonthlyPerformanceBreakdown({ employeeId: activeEmployeeId, month }),
    enabled: Boolean(activeEmployeeId),
  });

  const toggleExpand = (id) => {
    setExpandedCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedEmployee = employees.find(
    (e) => String(e._id) === String(activeEmployeeId)
  );

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-4 flex-1 min-w-[280px]">
          <div className="w-full sm:w-72">
            <Select
              label="Select Employee"
              value={activeEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              disabled={loadingEmployees}
            >
              <option value="">Select employee...</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name} ({positionLabel(emp.role)}) {emp.department?.name ? `· ${emp.department.name}` : ""} {emp.team?.name ? `· ${emp.team.name}` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="pt-5">
            <MonthPicker month={month} onChange={setMonth} />
          </div>
        </div>

        {onRecordEvaluation && activeEmployeeId && (
          <div className="pt-2 sm:pt-0">
            <Button
              onClick={() => onRecordEvaluation(activeEmployeeId)}
              className="flex items-center gap-1.5"
            >
              <Plus size={16} />
              Record Evaluation
            </Button>
          </div>
        )}
      </div>

      {loadingBreakdown && (
        <div className="rounded-card border border-border bg-surface p-12 text-center text-muted">
          <Clock className="mx-auto mb-2 animate-spin" size={24} />
          <p className="text-sm">Calculating performance breakdown...</p>
        </div>
      )}

      {breakdownError && !loadingBreakdown && (
        <div className="rounded-card border border-danger/30 bg-danger/5 p-6 text-center text-danger">
          <AlertCircle className="mx-auto mb-2" size={24} />
          <p className="text-sm font-medium">{breakdownError.message || "Failed to load breakdown"}</p>
        </div>
      )}

      {!loadingBreakdown && !breakdownError && !breakdown && (
        <EmptyState
          icon={User}
          heading="No employee selected"
          description="Select an employee above to view their monthly performance calculation."
        />
      )}

      {!loadingBreakdown && breakdown && (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Monthly Score */}
            <div className="rounded-card border border-border bg-surface p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Total Monthly Score
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-foreground">
                  {fmtScore(breakdown.totalScore)}
                </span>
                <span className="text-sm text-muted">/ 100</span>
              </div>
              <p className="mt-2 text-xs text-muted">
                Weighted aggregate from all active criteria
              </p>
            </div>

            {/* Completeness Status */}
            <div className="rounded-card border border-border bg-surface p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Evaluation Completeness
              </span>
              <div className="mt-2">
                {breakdown.isComplete ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={14} />
                    All Periods Evaluated
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <AlertTriangle size={14} />
                    {breakdown.missingEvaluations?.length || 0} Incomplete Criteria
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-muted">
                {breakdown.isComplete
                  ? "Every expected evaluation period has been recorded"
                  : "Some scheduled periods have not been evaluated"}
              </p>
            </div>

            {/* Total Configured Weight */}
            <div className="rounded-card border border-border bg-surface p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Configured Weight
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-foreground">
                  {breakdown.totalWeightage}%
                </span>
                {breakdown.totalWeightage === 100 ? (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    (Valid 100%)
                  </span>
                ) : (
                  <span className="text-xs font-medium text-amber-500">
                    ({100 - breakdown.totalWeightage}% unallocated)
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-muted">
                Criteria assigned to {positionLabel(breakdown.employee?.role || selectedEmployee?.role)}
                {breakdown.employee?.department?.name ? ` · ${breakdown.employee.department.name}` : ""}
                {breakdown.employee?.team?.name ? ` · ${breakdown.employee.team.name}` : ""}
              </p>
            </div>

            {/* Rating Scale Reference */}
            <div className="rounded-card border border-border bg-surface p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Rating Scale Applied
              </span>
              <div className="mt-2 flex items-center justify-between gap-1 text-xs">
                <span className="rounded bg-rose-500/10 px-2 py-1 font-medium text-rose-600 dark:text-rose-400">
                  Poor: {breakdown.scoringScale?.poor ?? 25}%
                </span>
                <span className="rounded bg-amber-500/10 px-2 py-1 font-medium text-amber-600 dark:text-amber-400">
                  Avg: {breakdown.scoringScale?.average ?? 50}%
                </span>
                <span className="rounded bg-emerald-500/10 px-2 py-1 font-medium text-emerald-600 dark:text-emerald-400">
                  Good: {breakdown.scoringScale?.good ?? 100}%
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">
                Standard 3-tier scoring distribution
              </p>
            </div>
          </div>

          {/* Incomplete Evaluations Alert Banner */}
          {breakdown.missingEvaluations && breakdown.missingEvaluations.length > 0 && (
            <div className="rounded-card border border-amber-500/40 bg-amber-500/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 text-amber-500 shrink-0" size={18} />
                <div className="space-y-2 flex-1">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      Incomplete Evaluation Periods Detected for {monthLabel(month)}
                    </h2>
                    <p className="text-xs text-muted">
                      Evaluations have not been submitted for all scheduled periods. The monthly score below reflects only recorded periods.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 pt-1">
                    {breakdown.missingEvaluations.map((m) => (
                      <div
                        key={m.criterionId}
                        className="rounded border border-amber-500/20 bg-background/60 p-2.5 text-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">{m.criterionName}</span>
                            <span className={`rounded border px-1.5 py-0.2 capitalize text-[10px] ${FREQ_COLORS[m.frequency] || ""}`}>
                              {m.frequency}
                            </span>
                          </div>
                          <p className="mt-1 text-muted">
                            Missing {m.missingPeriods.length} period(s):
                          </p>
                          <ul className="mt-1 space-y-0.5 text-amber-600 dark:text-amber-400">
                            {m.missingPeriods.slice(0, 3).map((p, idx) => (
                              <li key={idx} className="truncate">
                                • {p.label || `${p.startDate} → ${p.endDate}`}
                              </li>
                            ))}
                            {m.missingPeriods.length > 3 && (
                              <li className="text-[11px] text-muted">
                                + {m.missingPeriods.length - 3} more...
                              </li>
                            )}
                          </ul>
                        </div>
                        {onRecordEvaluation && (
                          <button
                            type="button"
                            onClick={() => onRecordEvaluation(activeEmployeeId, m.criterionId)}
                            className="mt-2 text-left font-medium text-primary hover:underline text-[11px]"
                          >
                            + Record missing evaluation
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Criteria Breakdown Table / Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight">
                Evaluation Criteria Breakdown
              </h2>
              <span className="text-xs text-muted">
                {breakdown.criteriaBreakdown?.length || 0} main criteria configured
              </span>
            </div>

            {breakdown.criteriaBreakdown?.length === 0 ? (
              <div className="rounded-card border border-border bg-surface p-8 text-center text-muted">
                <p className="text-sm">
                  No active performance criteria apply to this employee&apos;s department and position.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {breakdown.criteriaBreakdown.map((criterion) => {
                  const isExpanded = expandedCriteria.has(criterion._id);
                  const hasSubs = criterion.hasSubCriteria && criterion.subCriteria?.length > 0;

                  return (
                    <div
                      key={criterion._id}
                      className="rounded-card border border-border bg-surface overflow-hidden transition-colors"
                    >
                      {/* Main Criterion Header Row */}
                      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          {hasSubs && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(criterion._id)}
                              className="mt-1 rounded p-1 hover:bg-background text-muted hover:text-foreground transition-colors"
                              aria-label="Toggle sub-criteria"
                            >
                              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </button>
                          )}
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-foreground text-sm">
                                {criterion.name}
                              </h3>
                              {hasSubs ? (
                                <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                  {criterion.subCriteria.length} Sub-criteria
                                </span>
                              ) : (
                                <span
                                  className={`rounded border px-2 py-0.5 text-[11px] capitalize font-medium ${
                                    FREQ_COLORS[criterion.frequency] || ""
                                  }`}
                                >
                                  {criterion.frequency}
                                </span>
                              )}
                              <span className="rounded bg-border/60 px-2 py-0.5 text-[11px] font-medium text-muted">
                                Weight: {criterion.weightage}%
                              </span>
                            </div>
                            {criterion.description && (
                              <p className="mt-1 text-xs text-muted">{criterion.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Metrics and Score Contribution */}
                        <div className="flex flex-wrap items-center gap-6 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0">
                          {/* Performance % */}
                          <div className="text-right">
                            <span className="text-[11px] uppercase tracking-wide text-muted">
                              Performance
                            </span>
                            <p className="text-sm font-semibold tabular-nums">
                              {criterion.avgNumericScore !== null ? `${criterion.avgNumericScore}%` : "—"}
                            </p>
                          </div>

                          {/* Weighted Score */}
                          <div className="text-right">
                            <span className="text-[11px] uppercase tracking-wide text-muted">
                              Score Contribution
                            </span>
                            <div className="flex items-baseline justify-end gap-1">
                              <span className="text-base font-bold tabular-nums text-foreground">
                                {fmtScore(criterion.score)}
                              </span>
                              <span className="text-xs text-muted">/ {criterion.maxScore}</span>
                            </div>
                          </div>

                          {/* Quick Action */}
                          {!hasSubs && onRecordEvaluation && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => onRecordEvaluation(activeEmployeeId, criterion._id)}
                              className="text-xs"
                            >
                              <Plus size={14} /> Evaluate
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Mathematical Calculation step */}
                      <div className="px-4 py-2 border-t border-border/50 bg-background/30 text-xs text-muted flex flex-wrap items-center justify-between gap-2">
                        <span>
                          Calculation: <code className="text-foreground font-mono">{criterion.calculation}</code>
                        </span>
                        {!hasSubs && (
                          <span>
                            Recorded:{" "}
                            <strong className={criterion.isComplete ? "text-emerald-500" : "text-amber-500"}>
                              {criterion.recordedCount} / {criterion.expectedCount} periods
                            </strong>
                          </span>
                        )}
                      </div>

                      {/* Per-period marks (e.g. each week of the month) */}
                      {!hasSubs && criterion.periods?.length > 0 && (
                        <div className="px-4 py-3 border-t border-border/40">
                          <PeriodMarks
                            criterion={criterion}
                            onMark={onRecordEvaluation ? (date) => onRecordEvaluation(activeEmployeeId, criterion._id, date) : undefined}
                          />
                        </div>
                      )}

                      {/* Ratings Pill Summary for Standalone Criterion */}
                      {!hasSubs && criterion.ratingsCount && (
                        <div className="px-4 py-2.5 border-t border-border/40 flex flex-wrap items-center gap-4 text-xs">
                          <span className="text-muted">Ratings logged:</span>
                          <span className="inline-flex items-center gap-1 text-rose-500">
                            <ThumbsDown size={13} /> Poor: <strong>{criterion.ratingsCount.poor}</strong>
                          </span>
                          <span className="inline-flex items-center gap-1 text-amber-500">
                            <Minus size={13} /> Average: <strong>{criterion.ratingsCount.average}</strong>
                          </span>
                          <span className="inline-flex items-center gap-1 text-emerald-500">
                            <ThumbsUp size={13} /> Good: <strong>{criterion.ratingsCount.good}</strong>
                          </span>
                          {criterion.evaluations?.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedEvaluationDetail(
                                  selectedEvaluationDetail?._id === criterion._id ? null : criterion
                                )
                              }
                              className="ml-auto text-primary hover:underline text-xs flex items-center gap-1"
                            >
                              <FileText size={13} />
                              {selectedEvaluationDetail?._id === criterion._id ? "Hide entries" : `View ${criterion.evaluations.length} entries`}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Entries Drawer/List for Standalone Criterion */}
                      {selectedEvaluationDetail?._id === criterion._id && criterion.evaluations?.length > 0 && (
                        <div className="border-t border-border/50 bg-background/50 p-3 space-y-2">
                          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
                            Evaluation History for {criterion.name}
                          </h4>
                          <div className="divide-y divide-border/40 rounded border border-border/60 bg-surface">
                            {criterion.evaluations.map((ev) => (
                              <div key={ev._id} className="p-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <span className="font-medium text-foreground">{ev.period?.label || ev.period?.startDate}</span>
                                  <span className="text-muted ml-2">by {ev.evaluator?.name || "Evaluator"}</span>
                                  {ev.comment && <p className="text-muted mt-1 italic">&ldquo;{ev.comment}&rdquo;</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`rounded px-2 py-0.5 capitalize font-medium ${
                                      ev.rating === "good"
                                        ? "bg-emerald-500/10 text-emerald-500"
                                        : ev.rating === "average"
                                        ? "bg-amber-500/10 text-amber-500"
                                        : "bg-rose-500/10 text-rose-500"
                                    }`}
                                  >
                                    {ev.rating} ({ev.numericScore}%)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sub-Criteria Table (if expanded or by default) */}
                      {hasSubs && isExpanded && (
                        <div className="border-t border-border/60 bg-background/40 p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
                            Sub-Criteria Evaluation Details
                          </h4>
                          <div className="space-y-2">
                            {criterion.subCriteria.map((sub) => (
                              <div
                                key={sub._id}
                                className="rounded border border-border/70 bg-surface p-3 text-xs space-y-2"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-primary font-bold">↳</span>
                                      <span className="font-semibold text-foreground">{sub.name}</span>
                                      <span
                                        className={`rounded border px-1.5 py-0.2 capitalize text-[10px] ${
                                          FREQ_COLORS[sub.frequency] || ""
                                        }`}
                                      >
                                        {sub.frequency}
                                      </span>
                                      <span className="rounded bg-border/40 px-1.5 py-0.2 text-[10px] text-muted">
                                        Weight: {sub.weightage}% of parent
                                      </span>
                                    </div>
                                    {sub.description && (
                                      <p className="mt-1 text-muted text-[11px]">{sub.description}</p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <div className="text-right">
                                      <span className="text-[10px] text-muted uppercase">Avg Score</span>
                                      <p className="font-semibold text-sm">
                                        {sub.avgNumericScore !== null ? `${sub.avgNumericScore}%` : "—"}
                                      </p>
                                    </div>

                                    {onRecordEvaluation && (
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onRecordEvaluation(activeEmployeeId, sub._id)}
                                        className="text-xs h-7 px-2"
                                      >
                                        <Plus size={12} /> Evaluate
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px]">
                                  <div className="flex items-center gap-3">
                                    <span className="text-muted">
                                      Periods:{" "}
                                      <strong className={sub.isComplete ? "text-emerald-500" : "text-amber-500"}>
                                        {sub.recordedCount} / {sub.expectedCount} recorded
                                      </strong>
                                    </span>
                                    <span>·</span>
                                    <span className="text-rose-500">Poor: {sub.ratingsCount?.poor || 0}</span>
                                    <span className="text-amber-500">Avg: {sub.ratingsCount?.average || 0}</span>
                                    <span className="text-emerald-500">Good: {sub.ratingsCount?.good || 0}</span>
                                  </div>

                                  {sub.evaluations?.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedEvaluationDetail(
                                          selectedEvaluationDetail?._id === sub._id ? null : sub
                                        )
                                      }
                                      className="text-primary hover:underline flex items-center gap-1"
                                    >
                                      <FileText size={11} />
                                      {selectedEvaluationDetail?._id === sub._id ? "Hide entries" : `${sub.evaluations.length} entries`}
                                    </button>
                                  )}
                                </div>

                                <PeriodMarks
                                  compact
                                  criterion={sub}
                                  onMark={onRecordEvaluation ? (date) => onRecordEvaluation(activeEmployeeId, sub._id, date) : undefined}
                                />

                                {/* Evaluation entries popup/list */}
                                {selectedEvaluationDetail?._id === sub._id && sub.evaluations?.length > 0 && (
                                  <div className="mt-2 divide-y divide-border/40 rounded border border-border/60 bg-background/60 p-2 space-y-1">
                                    {sub.evaluations.map((ev) => (
                                      <div key={ev._id} className="pt-1.5 first:pt-0 flex items-center justify-between text-[11px]">
                                        <div>
                                          <span className="font-medium text-foreground">{ev.period?.label || ev.period?.startDate}</span>
                                          <span className="text-muted ml-2">by {ev.evaluator?.name || "Evaluator"}</span>
                                          {ev.comment && <p className="text-muted italic">&ldquo;{ev.comment}&rdquo;</p>}
                                        </div>
                                        <span
                                          className={`rounded px-1.5 py-0.2 capitalize font-medium ${
                                            ev.rating === "good"
                                              ? "text-emerald-500"
                                              : ev.rating === "average"
                                              ? "text-amber-500"
                                              : "text-rose-500"
                                          }`}
                                        >
                                          {ev.rating} ({ev.numericScore}%)
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
