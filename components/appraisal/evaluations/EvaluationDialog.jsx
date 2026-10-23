"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThumbsDown, Minus, ThumbsUp, Calendar, AlertCircle } from "lucide-react";

import Dialog from "@/components/ui/Dialog";
import { Button, Select, Textarea, Input } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import {
  fetchEvaluatableEmployees,
  fetchAppraisalSettings,
  recordPerformanceEvaluation,
} from "@/services/appraisalsService";
import { apiError, criterionAppliesTo, positionLabel } from "@/lib/appraisal";
import { getPeriodBounds } from "@/lib/appraisalPeriod";

const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

const schema = yup.object({
  employeeId: yup.string().required("Select an employee"),
  criterionId: yup.string().required("Select a criterion to evaluate"),
  date: yup.string().required("Date is required"),
  rating: yup.string().oneOf(["poor", "average", "good"], "Select a rating").required("Rating is required"),
  comment: yup.string().max(2000),
});

export default function EvaluationDialog({ open, onClose: onCloseProp, initialEmployeeId, initialCriterionId, initialDate }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const onClose = () => {
    setError("");
    onCloseProp();
  };

  const { data: employees = [] } = useQuery({
    queryKey: ["evaluatable-employees"],
    queryFn: fetchEvaluatableEmployees,
    enabled: open,
  });

  const { data: settingsData } = useQuery({
    queryKey: ["appraisal-settings"],
    queryFn: fetchAppraisalSettings,
    enabled: open,
  });

  const allCriteria = settingsData?.criteria || [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      employeeId: initialEmployeeId || "",
      criterionId: initialCriterionId || "",
      date: today(),
      rating: "good",
      comment: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        employeeId: initialEmployeeId || "",
        criterionId: initialCriterionId || "",
        date: initialDate || today(),
        rating: "good",
        comment: "",
      });
    }
  }, [open, initialEmployeeId, initialCriterionId, initialDate, reset]);

  const selectedEmployeeId = useWatch({ control, name: "employeeId" });
  const selectedCriterionId = useWatch({ control, name: "criterionId" });
  const selectedRating = useWatch({ control, name: "rating" });
  const selectedDate = useWatch({ control, name: "date" });

  const selectedEmployee = employees.find((e) => String(e._id) === String(selectedEmployeeId));

  // Only the criteria assigned to this employee's department, team and position
  const applicableCriteria = allCriteria.filter((c) => c.isActive && criterionAppliesTo(c, selectedEmployee));

  const currentCriterion = allCriteria.find((c) => String(c._id) === String(selectedCriterionId));
  const currentPeriod = currentCriterion ? getPeriodBounds(currentCriterion.frequency || "monthly", selectedDate) : null;

  const save = useMutation({
    onMutate: () => setError(""),
    mutationFn: (v) => recordPerformanceEvaluation(v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance-evaluations"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-performance-breakdown"] });
      toast.success("Performance evaluation recorded");
      onClose();
    },
    onError: (e) => {
      const msg = apiError(e);
      setError(msg);
      toast.error(msg);
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record Performance Evaluation"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={handleSubmit((v) => save.mutate(v))}>
            Save evaluation
          </Button>
        </>
      }
    >
      <form className="space-y-4" noValidate>
        {error && (
          <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Employee to evaluate" error={errors.employeeId?.message} {...register("employeeId")}>
            <option value="">Select employee…</option>
            {employees.map((e) => (
              <option key={e._id} value={e._id}>
                {e.name} {e.designation ? `(${e.designation})` : ""} {e.department?.name ? `· ${e.department.name}` : ""}
              </option>
            ))}
          </Select>

          <Input
            label="Evaluation Date"
            type="date"
            max={today()}
            error={errors.date?.message}
            {...register("date")}
          />
        </div>

        {selectedEmployee && (
          <div className="rounded-card border border-border/80 bg-background/50 p-3 text-xs flex items-center justify-between">
            <div>
              <span className="text-muted">Target Assignment:</span>{" "}
              <strong>{selectedEmployee.department?.name || "No Department"}</strong> ·{" "}
              <strong>{selectedEmployee.team?.name || "No Team"}</strong> ·{" "}
              <span className="text-primary font-medium">{positionLabel(selectedEmployee.role)}
                {selectedEmployee.designation ? ` (${selectedEmployee.designation})` : ""}
              </span>
            </div>
            <span className="text-muted">{applicableCriteria.length} criteria apply</span>
          </div>
        )}

        <div>
          <Select label="Criterion" error={errors.criterionId?.message} {...register("criterionId")}>
            <option value="">Select criterion…</option>
            {applicableCriteria.map((c) => {
              const isSub = Boolean(c.parentCriterion);
              const parent = isSub ? allCriteria.find((p) => String(p._id) === String(c.parentCriterion)) : null;
              return (
                <option key={c._id} value={c._id}>
                  {isSub ? `↳ ${c.name} (Sub-criterion of ${parent?.name || "Main"})` : `${c.name} (Main Criterion)`} — [
                  {c.frequency || "monthly"}] ({c.weightage}%)
                </option>
              );
            })}
          </Select>
          {currentCriterion && (
            <p className="mt-1 text-xs text-muted">
              Frequency: <strong className="capitalize text-foreground">{currentCriterion.frequency || "monthly"}</strong> ·{" "}
              Weight: <strong className="text-foreground">{currentCriterion.weightage}%</strong>
              {currentCriterion.description ? ` — ${currentCriterion.description}` : ""}
            </p>
          )}
          {currentPeriod && (
            <p className="mt-1 text-xs text-muted">
              Marking for (IST): <strong className="text-foreground">{currentPeriod.label}</strong> · counts towards{" "}
              {currentPeriod.frequency === "monthly"
                ? `${currentPeriod.month} (monthly score = average of the weekly marks)`
                : currentPeriod.month}
            </p>
          )}
        </div>

        {/* Rating Options */}
        <div className="space-y-2 pt-1">
          <label className="text-sm font-medium">Performance Rating</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                key: "poor",
                label: "Poor",
                icon: ThumbsDown,
                score: "25%",
                color: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
                selectedColor: "border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/20 text-rose-600 font-semibold",
              },
              {
                key: "average",
                label: "Average",
                icon: Minus,
                score: "50%",
                color: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                selectedColor: "border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/20 text-amber-600 font-semibold",
              },
              {
                key: "good",
                label: "Good",
                icon: ThumbsUp,
                score: "100%",
                color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                selectedColor: "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/20 text-emerald-600 font-semibold",
              },
            ].map((r) => {
              const isSelected = selectedRating === r.key;
              const Icon = r.icon;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setValue("rating", r.key)}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-card border p-3.5 text-center transition-all duration-150 ${
                    isSelected ? r.selectedColor : `${r.color} hover:bg-surface-elevated opacity-80 hover:opacity-100`
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-sm">{r.label}</span>
                  <span className="text-[11px] opacity-80">{r.score}</span>
                </button>
              );
            })}
          </div>
          {errors.rating?.message && (
            <p className="text-xs text-danger">{errors.rating.message}</p>
          )}
        </div>

        <Textarea
          label="Supporting Feedback / Comments (Optional)"
          rows={3}
          placeholder="Add observations, feedback, or justification for this rating..."
          {...register("comment")}
        />
      </form>
    </Dialog>
  );
}
