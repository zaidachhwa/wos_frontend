"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Filter,
  Trash2,
  ThumbsDown,
  Minus,
  ThumbsUp,
  Plus,
  Clock,
  User,
  MessageSquare,
} from "lucide-react";

import MonthPicker from "@/components/appraisal/MonthPicker";
import Badge from "@/components/ui/Badge";
import { Button, Select, Input } from "@/components/ui/Field";
import EmptyState from "@/components/ui/EmptyState";
import useToast from "@/hooks/useToast";
import { useAuthStore } from "@/store/authStore";
import {
  fetchEvaluatableEmployees,
  fetchPerformanceEvaluations,
  deletePerformanceEvaluation,
} from "@/services/appraisalsService";
import { HR_ROLES, apiError, currentIstMonth, fmtDateTime } from "@/lib/appraisal";

const FREQ_COLORS = {
  daily: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  weekly: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  biweekly: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  monthly: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

export default function EvaluationHistoryTable({ onRecordEvaluation }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isHr = HR_ROLES.includes(currentUser?.role);

  const [employeeFilter, setEmployeeFilter] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState(currentIstMonth());
  const [expandedCommentId, setExpandedCommentId] = useState(null);

  const { data: employees = [] } = useQuery({
    queryKey: ["evaluatable-employees"],
    queryFn: fetchEvaluatableEmployees,
  });

  const { data: evaluations = [], isLoading } = useQuery({
    queryKey: [
      "performance-evaluations",
      {
        employee: employeeFilter,
        frequency: frequencyFilter,
        month: monthFilter,
      },
    ],
    queryFn: () =>
      fetchPerformanceEvaluations({
        employee: employeeFilter || undefined,
        frequency: frequencyFilter || undefined,
        month: monthFilter || undefined,
      }),
  });

  const removeMutation = useMutation({
    mutationFn: (id) => deletePerformanceEvaluation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance-evaluations"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-performance-breakdown"] });
      toast.success("Evaluation record deleted");
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const handleDelete = (id, employeeName, criterionName) => {
    if (
      window.confirm(
        `Are you sure you want to delete this evaluation for "${employeeName}" (${criterionName})?`
      )
    ) {
      removeMutation.mutate(id);
    }
  };

  const canDeleteEvaluation = (ev) => {
    if (isHr) return true;
    return String(ev.evaluator?._id || ev.evaluator) === String(currentUser?._id);
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Employee Filter */}
          <div className="w-full sm:w-60">
            <Select
              label="Filter by Employee"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
            >
              <option value="">All employees</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name} {emp.designation ? `(${emp.designation})` : ""}
                </option>
              ))}
            </Select>
          </div>

          {/* Frequency Filter */}
          <div className="w-full sm:w-44">
            <Select
              label="Frequency"
              value={frequencyFilter}
              onChange={(e) => setFrequencyFilter(e.target.value)}
            >
              <option value="">All frequencies</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </div>

          {/* Month Stepper */}
          <div className="pt-5">
            <MonthPicker month={monthFilter} onChange={setMonthFilter} />
          </div>
        </div>

        {onRecordEvaluation && (
          <div className="pt-2 sm:pt-0">
            <Button
              onClick={() => onRecordEvaluation(employeeFilter || undefined)}
              className="flex items-center gap-1.5"
            >
              <Plus size={16} />
              Record Evaluation
            </Button>
          </div>
        )}
      </div>

      {/* Table Content */}
      {isLoading ? (
        <div className="rounded-card border border-border bg-surface p-12 text-center text-muted">
          <Clock className="mx-auto mb-2 animate-spin" size={24} />
          <p className="text-sm">Loading evaluation records...</p>
        </div>
      ) : evaluations.length === 0 ? (
        <EmptyState
          icon={Calendar}
          heading="No evaluations recorded"
          description="No evaluation records found matching the selected filters. Use the button above to record an evaluation."
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-background/60 text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Period / Date</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Criterion</th>
                <th className="px-4 py-3 text-center">Rating</th>
                <th className="px-4 py-3 text-center">Score</th>
                <th className="px-4 py-3">Evaluator</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {evaluations.map((ev) => {
                const isSub = Boolean(ev.criterion?.parentCriterion);
                const hasComment = Boolean(ev.comment);
                const isCommentExpanded = expandedCommentId === ev._id;

                return (
                  <tr key={ev._id} className="hover:bg-background/40 transition-colors">
                    {/* Period & Frequency */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">
                          {ev.period?.label || `${ev.period?.startDate} → ${ev.period?.endDate}`}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded border px-1.5 py-0.2 capitalize text-[10px] font-medium ${
                              FREQ_COLORS[ev.period?.frequency] || ""
                            }`}
                          >
                            {ev.period?.frequency}
                          </span>
                          <span className="text-[11px] text-muted">
                            {ev.recordedAt ? new Date(ev.recordedAt).toLocaleDateString() : ""}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Employee */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-foreground">
                          {ev.employee?.name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted">
                          {ev.employee?.designation || "General"}
                          {ev.employee?.department?.name ? ` · ${ev.employee.department.name}` : ""}
                        </p>
                      </div>
                    </td>

                    {/* Criterion */}
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {isSub && <span className="text-primary font-bold">↳</span>}
                          <span className="font-medium text-foreground">
                            {ev.criterion?.name || "Criterion"}
                          </span>
                        </div>
                        {isSub && (
                          <span className="text-[11px] text-muted">
                            Sub-criterion ({ev.criterion?.weightage}% wt)
                          </span>
                        )}
                        {!isSub && (
                          <span className="text-[11px] text-muted">
                            Main criterion ({ev.criterion?.weightage}% wt)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Rating Badge */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {ev.rating === "good" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <ThumbsUp size={12} /> Good
                        </span>
                      )}
                      {ev.rating === "average" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          <Minus size={12} /> Average
                        </span>
                      )}
                      {ev.rating === "poor" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                          <ThumbsDown size={12} /> Poor
                        </span>
                      )}
                    </td>

                    {/* Numeric Score */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="font-semibold tabular-nums text-foreground">
                        {ev.numericScore}%
                      </span>
                    </td>

                    {/* Evaluator */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-foreground font-medium">
                        {ev.evaluator?.name || "—"}
                      </span>
                      <span className="block text-[11px] capitalize text-muted">
                        {ev.evaluator?.role || ""}
                      </span>
                    </td>

                    {/* Comments */}
                    <td className="px-4 py-3 max-w-[200px]">
                      {hasComment ? (
                        <div>
                          <p
                            className={`text-xs text-muted ${
                              isCommentExpanded ? "" : "line-clamp-2"
                            }`}
                          >
                            &ldquo;{ev.comment}&rdquo;
                          </p>
                          {ev.comment.length > 60 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCommentId(isCommentExpanded ? null : ev._id)
                              }
                              className="text-[11px] text-primary hover:underline mt-0.5"
                            >
                              {isCommentExpanded ? "Show less" : "Read more"}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted/60">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canDeleteEvaluation(ev) && (
                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(
                              ev._id,
                              ev.employee?.name || "employee",
                              ev.criterion?.name || "criterion"
                            )
                          }
                          disabled={removeMutation.isPending}
                          className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                          title="Delete evaluation record"
                          aria-label="Delete evaluation"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
