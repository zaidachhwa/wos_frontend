"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import Badge from "@/components/ui/Badge";
import { Input, Textarea, Button } from "@/components/ui/Field";
import { saveFollowUp } from "@/services/followupService";

const FIELDS = {
  morning: [
    ["yesterdayCompleted", "Yesterday I completed", "textarea"],
    ["todayPlan", "Today's plan", "textarea"],
    ["blockers", "Current blockers", "textarea"],
    ["estimatedHours", "Estimated working hours", "number"],
  ],
  evening: [
    ["completedWork", "Completed work", "textarea"],
    ["remainingWork", "Remaining work", "textarea"],
    ["tomorrowPlan", "Tomorrow's plan", "textarea"],
    ["actualHours", "Actual hours worked", "number"],
    ["challenges", "Challenges faced", "textarea"],
  ],
};

export default function FollowUpCard({ type, date, followUp }) {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState("");
  const status = followUp?.status || "draft";
  const locked = status === "reviewed";

  const { register, handleSubmit } = useForm({
    values: FIELDS[type].reduce(
      (acc, [name]) => ({ ...acc, [name]: followUp?.[type]?.[name] ?? "" }),
      {}
    ),
    // Refetches must not clobber keystrokes typed while a save is in flight.
    resetOptions: { keepDirtyValues: true },
  });

  const mutation = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: ({ values, submit }) => {
      const data = { ...values };
      const hoursField = type === "morning" ? "estimatedHours" : "actualHours";
      data[hoursField] = data[hoursField] === "" ? undefined : Number(data[hoursField]);
      return saveFollowUp({ date, type, data, submit });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["followups"] }),
    onError: (error) => setApiError(error.response?.data?.message || "Something went wrong"),
  });

  return (
    <section className="rounded-card border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold capitalize tracking-tight">{type} follow-up</h3>
        <Badge value={followUp ? status : "missing"} />
      </div>

      {locked ? (
        <div className="mt-4 space-y-3 text-sm">
          {FIELDS[type].map(([name, label]) => (
            <div key={name}>
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-0.5 whitespace-pre-wrap">{String(followUp?.[type]?.[name] ?? "—")}</p>
            </div>
          ))}
          {followUp?.managerComment && (
            <div className="rounded-input border border-success/30 bg-success/5 px-3 py-2">
              <p className="text-xs font-medium text-success">Manager comment</p>
              <p className="mt-0.5 whitespace-pre-wrap">{followUp.managerComment}</p>
            </div>
          )}
        </div>
      ) : (
        <form className="mt-4 space-y-3" noValidate>
          {apiError && (
            <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {apiError}
            </p>
          )}
          {FIELDS[type].map(([name, label, kind]) =>
            kind === "number" ? (
              <Input key={name} label={label} type="number" min="0" step="0.5" {...register(name)} />
            ) : (
              <Textarea key={name} label={label} rows={2} {...register(name)} />
            )
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              type="button"
              disabled={mutation.isPending}
              onClick={handleSubmit((values) => mutation.mutate({ values, submit: false }))}
            >
              Save draft
            </Button>
            <Button
              type="button"
              disabled={mutation.isPending}
              onClick={handleSubmit((values) => mutation.mutate({ values, submit: true }))}
            >
              {status === "submitted" ? "Resubmit" : "Submit"}
            </Button>
          </div>
          {status === "submitted" && (
            <p className="text-xs text-muted">
              Submitted {followUp?.submittedAt ? new Date(followUp.submittedAt).toLocaleTimeString() : ""} — you can
              still edit until it&apos;s reviewed.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
