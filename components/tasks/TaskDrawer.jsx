"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Plus } from "lucide-react";

import Drawer from "@/components/ui/Drawer";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { Select, Button } from "@/components/ui/Field";
import { useAuthStore } from "@/store/authStore";
import { fetchTask, updateTask, addComment } from "@/services/taskService";

const STATUSES = ["backlog", "todo", "in_progress", "review", "testing", "completed", "blocked"];
const PRIORITIES = ["low", "medium", "high", "critical"];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

export default function TaskDrawer({ task: taskStub, onClose, directory = [] }) {
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [apiError, setApiError] = useState("");

  const open = Boolean(taskStub);
  const { data: task } = useQuery({
    queryKey: ["task", taskStub?._id],
    queryFn: () => fetchTask(taskStub._id),
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["task", taskStub?._id] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    if (task?.project) queryClient.invalidateQueries({ queryKey: ["project", String(task.project)] });
  };

  const patch = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: (payload) => updateTask({ id: taskStub._id, ...payload }),
    onSuccess: invalidate,
    onError: (e) => setApiError(e.response?.data?.message || "Something went wrong"),
  });

  const commentMutation = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: () => addComment({ id: taskStub._id, text: comment }),
    onSuccess: () => {
      setComment("");
      invalidate();
    },
    onError: (e) => setApiError(e.response?.data?.message || "Something went wrong"),
  });

  if (!open) return null;

  const isAssignee = task?.assignee?._id === me?._id;
  const canManage = ["admin", "manager", "sublead"].includes(me?.role);
  const canEditStatus = canManage || isAssignee;

  const toggleSubtask = (index) => {
    const subtasks = task.subtasks.map((s, i) => (i === index ? { ...s, done: !s.done } : s));
    patch.mutate({ subtasks });
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    patch.mutate({ subtasks: [...(task.subtasks || []), { title: newSubtask.trim(), done: false }] });
    setNewSubtask("");
  };

  return (
    <Drawer open={open} onClose={onClose} title={task?.title || "Task"} wide>
      {!task ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          {apiError && (
            <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {apiError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Select
              label="Status"
              value={task.status}
              disabled={!canEditStatus || patch.isPending}
              onChange={(e) => patch.mutate({ status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </Select>
            <Select
              label="Priority"
              value={task.priority}
              disabled={!canManage || patch.isPending}
              onChange={(e) => patch.mutate({ priority: e.target.value })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Select
              label="Assignee"
              value={task.assignee?._id || ""}
              disabled={!canManage || patch.isPending}
              onChange={(e) => patch.mutate({ assignee: e.target.value || null })}
            >
              <option value="">Unassigned</option>
              {directory.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label htmlFor="collaborators" className="text-sm font-medium">
              Collaborators
            </label>
            <select
              id="collaborators"
              multiple
              value={(task.collaborators || []).map((c) => c._id)}
              disabled={!canManage || patch.isPending}
              onChange={(e) =>
                patch.mutate({ collaborators: Array.from(e.target.selectedOptions, (o) => o.value) })
              }
              className="mt-1 w-full rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary disabled:opacity-50"
              size={Math.min(4, directory.length || 1)}
            >
              {directory.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">Ctrl/Cmd-click to select multiple.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-card border border-border bg-background/60 p-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Deadline</p>
              <p className="mt-0.5 flex items-center gap-1.5 font-medium tabular-nums">
                {fmtDate(task.deadline)}
                {task.deadline && new Date(task.deadline) < new Date() && task.status !== "completed" && (
                  <Badge value="overdue" tone="danger" />
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Estimated</p>
              <p className="mt-0.5 font-medium tabular-nums">{task.estimatedHours ?? "—"}h</p>
            </div>
            <div>
              <p className="text-xs text-muted">Actual</p>
              <p className="mt-0.5 font-medium tabular-nums">{task.actualHours ?? "—"}h</p>
            </div>
          </div>

          {task.description && (
            <section>
              <h3 className="text-sm font-semibold">Description</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{task.description}</p>
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold">
              Subtasks{" "}
              <span className="font-normal text-muted">
                ({(task.subtasks || []).filter((s) => s.done).length}/{task.subtasks?.length || 0})
              </span>
            </h3>
            <ul className="mt-2 space-y-1">
              {(task.subtasks || []).map((s, i) => (
                <li key={s._id || i}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-btn px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-background">
                    <input
                      type="checkbox"
                      checked={s.done}
                      disabled={!canEditStatus || patch.isPending}
                      onChange={() => toggleSubtask(i)}
                      className="accent-primary"
                    />
                    <span className={s.done ? "text-muted line-through" : ""}>{s.title}</span>
                  </label>
                </li>
              ))}
            </ul>
            {canEditStatus && (
              <div className="mt-2 flex gap-2">
                <input
                  aria-label="New subtask"
                  placeholder="Add a subtask…"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSubtask()}
                  className="flex-1 rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
                />
                <Button variant="secondary" onClick={addSubtask} disabled={!newSubtask.trim() || patch.isPending}>
                  <Plus size={15} />
                </Button>
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold">Comments</h3>
            <ul className="mt-2 space-y-3">
              {(task.comments || []).map((c) => (
                <li key={c._id} className="rounded-card border border-border/60 bg-background/60 px-3 py-2">
                  <p className="text-xs text-muted">
                    <span className="font-medium text-primary">{c.user?.name || "Someone"}</span> ·{" "}
                    {new Date(c.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.text}</p>
                </li>
              ))}
              {!task.comments?.length && <li className="text-sm text-muted">No comments yet.</li>}
            </ul>
            <div className="mt-3 flex gap-2">
              <input
                aria-label="Write a comment"
                placeholder="Write a comment…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && comment.trim() && commentMutation.mutate()}
                className="flex-1 rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
              />
              <Button onClick={() => commentMutation.mutate()} disabled={!comment.trim() || commentMutation.isPending}>
                <Send size={15} />
              </Button>
            </div>
          </section>

        </div>
      )}
    </Drawer>
  );
}
