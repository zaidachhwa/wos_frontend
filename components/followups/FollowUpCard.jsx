"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Badge from "@/components/ui/Badge";
import { Input, Textarea, Button } from "@/components/ui/Field";
import { saveFollowUp, fetchFollowUpSuggestion, fetchFollowUps } from "@/services/followupService";
import useToast from "@/hooks/useToast";

// Subtracts one day from a "YYYY-MM-DD" string without going through a
// local-timezone Date parse (`new Date("2026-08-05")` parses as UTC
// midnight, so local .getDate()/.setDate() can land on the wrong day
// depending on the viewer's timezone) — parse and arithmetic both stay in
// UTC space, so the result is timezone-independent.
const dayBefore = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  const pad = (n) => String(n).padStart(2, "0");
  return `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}-${pad(prev.getUTCDate())}`;
};

// Resolves to {lat,lng} or null (denied/unsupported/timed out) — the
// backend decides whether a location is actually required, so a failure
// here just means we submit without coordinates and let its error surface.
const getCoords = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000 }
    );
  });

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
  const toast = useToast();
  const [apiError, setApiError] = useState("");
  const status = followUp?.status || "draft";
  const locked = status === "reviewed";

  // Suggested "yesterday I completed" text from actually-completed tasks; morning-only.
  const { data: suggestion } = useQuery({
    queryKey: ["followup-suggestion", date],
    queryFn: () => fetchFollowUpSuggestion(date),
    enabled: type === "morning" && !locked,
  });

  // Yesterday's evening entry, if they filled one in — preferred over the
  // task-derived suggestion above since it's what they actually reported,
  // and it's also where "today's plan" gets prefilled from (remainingWork).
  const yesterday = dayBefore(date);
  const { data: yesterdayEvening } = useQuery({
    queryKey: ["followups", "own", yesterday, "evening"],
    queryFn: async () => (await fetchFollowUps({ date: yesterday, type: "evening" }))[0] ?? null,
    enabled: type === "morning" && !locked,
  });

  const { register, handleSubmit } = useForm({
    // keepDirtyValues (below) re-syncs untouched fields whenever this object changes,
    // which is also what lets the prefills below fill in once they resolve after
    // mount without clobbering anything the user already typed or saved.
    values: FIELDS[type].reduce((acc, [name]) => {
      const existing = followUp?.[type]?.[name] ?? "";
      let value = existing;
      if (type === "morning" && name === "yesterdayCompleted") {
        value = existing || yesterdayEvening?.evening?.completedWork || suggestion?.yesterdayCompleted || "";
      } else if (type === "morning" && name === "todayPlan") {
        value = existing || yesterdayEvening?.evening?.remainingWork || "";
      }
      return { ...acc, [name]: value };
    }, {}),
    // Refetches must not clobber keystrokes typed while a save is in flight.
    resetOptions: { keepDirtyValues: true },
  });

  const mutation = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: async ({ values, submit }) => {
      const data = { ...values };
      const hoursField = type === "morning" ? "estimatedHours" : "actualHours";
      data[hoursField] = data[hoursField] === "" ? undefined : Number(data[hoursField]);
      const coords = submit ? await getCoords() : null;
      return saveFollowUp({ date, type, data, submit, ...coords });
    },
    onSuccess: (_data, { submit }) => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      toast.success(submit ? "Follow-up submitted" : "Draft saved");
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Something went wrong";
      setApiError(message);
      toast.error(message);
    },
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
