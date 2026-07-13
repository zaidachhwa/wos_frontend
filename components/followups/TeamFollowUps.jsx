"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";

import Badge from "@/components/ui/Badge";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Input, Select, Textarea, Button } from "@/components/ui/Field";
import { fetchFollowUps, reviewFollowUp } from "@/services/followupService";

const FIELD_LABELS = {
  yesterdayCompleted: "Yesterday completed",
  todayPlan: "Today's plan",
  blockers: "Blockers",
  estimatedHours: "Estimated hours",
  completedWork: "Completed work",
  remainingWork: "Remaining work",
  tomorrowPlan: "Tomorrow's plan",
  actualHours: "Actual hours",
  challenges: "Challenges",
};

export default function TeamFollowUps({ today, canReview }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(today);
  const [type, setType] = useState("morning");
  const [reviewing, setReviewing] = useState(null);
  const [comment, setComment] = useState("");
  const [apiError, setApiError] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["followups", "team", date, type],
    queryFn: () => fetchFollowUps({ scope: "team", date, type }),
  });

  const review = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: () => reviewFollowUp({ id: reviewing._id, managerComment: comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      setReviewing(null);
      setComment("");
    },
    onError: (error) => setApiError(error.response?.data?.message || "Something went wrong"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="mt-1">
          <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-card" />
      ) : rows?.length ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row._id || row.user._id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-card border bg-surface px-4 py-3 ${
                row.status === "missing" ? "border-danger/30" : "border-border"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-xs font-semibold uppercase text-muted">
                  {row.user?.name?.slice(0, 2)}
                </span>
                <div>
                  <p className="text-sm font-medium">{row.user?.name}</p>
                  <p className="text-xs capitalize text-muted">{row.user?.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge value={row.status} />
                {row.status !== "missing" && (
                  <Button variant="secondary" onClick={() => setReviewing(row)}>
                    {row.status === "reviewed" ? "View" : "Review"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={MessageSquare} heading="No reports found" description="People reporting to you will appear here." />
      )}

      <Dialog
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title={`${reviewing?.user?.name || ""} — ${type} follow-up`}
        footer={
          reviewing?.status === "submitted" && canReview ? (
            <>
              <Button variant="secondary" onClick={() => setReviewing(null)}>
                Close
              </Button>
              <Button disabled={review.isPending} onClick={() => review.mutate()}>
                Mark reviewed
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setReviewing(null)}>
              Close
            </Button>
          )
        }
      >
        {reviewing && (
          <div className="space-y-3 text-sm">
            {apiError && (
              <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {apiError}
              </p>
            )}
            {Object.entries(reviewing[type] || {})
              .filter(([k]) => FIELD_LABELS[k])
              .map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-muted">{FIELD_LABELS[k]}</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{String(v ?? "—") || "—"}</p>
                </div>
              ))}
            {reviewing.managerComment && (
              <div className="rounded-input border border-success/30 bg-success/5 px-3 py-2">
                <p className="text-xs font-medium text-success">Manager comment</p>
                <p className="mt-0.5 whitespace-pre-wrap">{reviewing.managerComment}</p>
              </div>
            )}
            {reviewing.status === "submitted" && canReview && (
              <Textarea
                label="Comment (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
