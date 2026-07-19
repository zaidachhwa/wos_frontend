"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";

import Badge from "@/components/ui/Badge";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Textarea, Button } from "@/components/ui/Field";
import { fetchTasks, approveTask, rejectTask } from "@/services/taskService";
import useToast from "@/hooks/useToast";

// Manager/admin review queue for member-proposed tasks — mirrors
// TeamFollowUps' review-dialog pattern (approve/reject + optional comment).
export default function ApprovalQueue() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [reviewing, setReviewing] = useState(null);
  const [comment, setComment] = useState("");
  const [apiError, setApiError] = useState("");

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", { approvalStatus: "pending" }],
    queryFn: () => fetchTasks({ approvalStatus: "pending" }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    setReviewing(null);
    setComment("");
  };

  const approve = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: () => approveTask({ id: reviewing._id }),
    onSuccess: () => {
      toast.success("Task approved");
      invalidate();
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Something went wrong";
      setApiError(message);
      toast.error(message);
    },
  });

  const reject = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: () => rejectTask({ id: reviewing._id, approvalComment: comment }),
    onSuccess: () => {
      toast.success("Task rejected");
      invalidate();
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Something went wrong";
      setApiError(message);
      toast.error(message);
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-card" />;

  if (!tasks?.length) {
    return <EmptyState icon={ClipboardCheck} heading="Nothing pending approval" description="Tasks proposed by your team will show up here." />;
  }

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <div
          key={t._id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium">{t.title}</p>
            <p className="text-xs text-muted">Proposed by {t.assignees?.[0]?.name || "someone"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge value="pending" />
            <Button variant="secondary" onClick={() => setReviewing(t)}>
              Review
            </Button>
          </div>
        </div>
      ))}

      <Dialog
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title={reviewing?.title || ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewing(null)}>
              Close
            </Button>
            <Button variant="danger" disabled={reject.isPending || !comment.trim()} onClick={() => reject.mutate()}>
              Reject
            </Button>
            <Button disabled={approve.isPending} onClick={() => approve.mutate()}>
              Approve
            </Button>
          </>
        }
      >
        {reviewing && (
          <div className="space-y-3 text-sm">
            {apiError && (
              <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {apiError}
              </p>
            )}
            {reviewing.description && <p className="whitespace-pre-wrap text-muted">{reviewing.description}</p>}
            <div className="flex gap-4 text-xs text-muted">
              <span>Priority: {reviewing.priority}</span>
              {reviewing.estimatedHours != null && <span>Est. {reviewing.estimatedHours}h</span>}
            </div>
            <Textarea
              label="Reason (required to reject)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        )}
      </Dialog>
    </div>
  );
}
