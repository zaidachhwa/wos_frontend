"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListTodo, Pencil, Trash2 } from "lucide-react";

import GeneralStats from "@/components/general/GeneralStats";
import GeneralTaskDialog from "@/components/general/GeneralTaskDialog";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { deleteGeneralTask, fetchGeneralTasks } from "@/services/generalTaskService";
import { STATUS_META, fmtDue } from "@/components/general/generalTaskUtils";

const PERSON_COLS = [
  ["total", "Total", ""],
  ["completed", "Completed", "text-success"],
  ["delayed", "Delayed", "text-warning"],
  ["overdue", "Overdue", "text-danger"],
  ["pending", "Pending", "text-info"],
];

// The Director's view of the tasks they assigned: overall stats, a
// per-person breakdown, and every task with each assignee's own status.
export default function AssignedByMeTasks() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ["general-tasks", "created", status],
    queryFn: () => fetchGeneralTasks({ scope: "created", status }),
  });
  const remove = useMutation({
    mutationFn: deleteGeneralTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-tasks"] });
      toast.success("Task deleted");
    },
    onError: (e) => toast.error(e.response?.data?.message || "Something went wrong"),
  });

  const tasks = data?.tasks || [];
  const people = data?.byPerson || [];

  return (
    <div className="space-y-6">
      <GeneralStats stats={data?.stats} active={status} onSelect={setStatus} />
      <p className="-mt-3 text-xs text-muted">Counts are per person: a task given to 3 people counts 3 times.</p>

      {people.length > 0 && !status && (
        <section className="overflow-x-auto rounded-card border border-border bg-surface">
          <h2 className="px-4 pt-4 text-sm font-semibold">By person</h2>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2 font-medium">Person</th>
                {PERSON_COLS.map(([k, label]) => (
                  <th key={k} className="px-4 py-2 text-right font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.user?._id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2">
                    <p className="font-medium">{p.user?.name || "Former user"}</p>
                    <p className="text-xs text-muted">{p.user?.designation || p.user?.role}</p>
                  </td>
                  {PERSON_COLS.map(([k, , tone]) => (
                    <td key={k} className={`px-4 py-2 text-right tabular-nums ${p[k] ? tone : "text-muted"}`}>
                      {p[k]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-card" />
      ) : tasks.length === 0 ? (
        <EmptyState icon={ListTodo} heading={status ? "No tasks with this status" : "No tasks assigned yet"} description="Use “New task” to assign one." />
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t._id} className="rounded-card border border-border bg-surface px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.title}</p>
                  {t.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{t.description}</p>}
                  <p className="mt-1 text-xs text-muted">
                    Due {fmtDue(t.dueAt)} · {t.stats.completed + t.stats.delayed}/{t.stats.total} done
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" aria-label={`Edit ${t.title}`} className="px-2" onClick={() => setEditing(t)}>
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Delete ${t.title}`}
                    className="px-2 text-danger"
                    disabled={remove.isPending}
                    onClick={() => window.confirm(`Delete "${t.title}"? Assignees will no longer see it.`) && remove.mutate(t._id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {t.assignments.map((a) => {
                  const meta = STATUS_META[a.status];
                  return (
                    <li
                      key={a.user?._id}
                      className="flex items-center gap-2 rounded-btn border border-border px-2.5 py-1 text-xs"
                      title={a.completedAt ? `Done ${fmtDue(a.completedAt)}` : meta.label}
                    >
                      {a.user?.name || "Former user"}
                      <Badge value={meta.label} tone={meta.tone} />
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <GeneralTaskDialog open={Boolean(editing)} onClose={() => setEditing(null)} task={editing} />
    </div>
  );
}
