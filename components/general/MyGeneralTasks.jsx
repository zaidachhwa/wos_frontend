"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ListTodo, RotateCcw } from "lucide-react";

import GeneralStats from "@/components/general/GeneralStats";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { fetchGeneralTasks, setGeneralTaskDone } from "@/services/generalTaskService";
import { STATUS_META, fmtDue } from "@/components/general/generalTaskUtils";

// An employee's General panel: tasks assigned to them, their own status
// on each, and their stats. They mark their own part done (or undo it).
export default function MyGeneralTasks() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["general-tasks", "assigned", status],
    queryFn: () => fetchGeneralTasks({ scope: "assigned", status }),
  });
  const toggle = useMutation({
    mutationFn: setGeneralTaskDone,
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ["general-tasks"] });
      toast.success(v.done ? "Marked as done" : "Marked as not done");
    },
    onError: (e) => toast.error(e.response?.data?.message || "Something went wrong"),
  });

  const tasks = data?.tasks || [];
  return (
    <div className="space-y-4">
      <GeneralStats stats={data?.stats} active={status} onSelect={setStatus} />
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-card" />
      ) : tasks.length === 0 ? (
        <EmptyState icon={ListTodo} heading={status ? `No ${STATUS_META[status]?.label.toLowerCase()} tasks` : "No tasks assigned to you"} />
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const done = Boolean(t.myCompletedAt);
            const meta = STATUS_META[t.myStatus] || STATUS_META.pending;
            return (
              <li key={t._id} className="flex flex-wrap items-start justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`font-medium ${done ? "text-muted line-through" : ""}`}>{t.title}</p>
                    <Badge value={meta.label} tone={meta.tone} />
                  </div>
                  {t.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{t.description}</p>}
                  <p className="mt-1 text-xs text-muted">
                    Due {fmtDue(t.dueAt)} · from {t.createdBy?.name || "Director"}
                    {done && ` · done ${fmtDue(t.myCompletedAt)}`}
                  </p>
                </div>
                {done ? (
                  <Button variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate({ id: t._id, done: false })}>
                    <RotateCcw size={15} /> Undo
                  </Button>
                ) : (
                  <Button disabled={toggle.isPending} onClick={() => toggle.mutate({ id: t._id, done: true })}>
                    <CheckCircle2 size={15} /> Mark done
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
