"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Plus, Trash2, Pencil, X } from "lucide-react";

import Drawer from "@/components/ui/Drawer";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import MultiSelect from "@/components/ui/MultiSelect";
import { Select, Button } from "@/components/ui/Field";
import { useAuthStore } from "@/store/authStore";
import {
  fetchTask,
  updateTask,
  addComment,
  updateComment,
  deleteComment,
  deleteTask,
} from "@/services/taskService";
import useToast from "@/hooks/useToast";
import { isTaskOverdue } from "@/lib/taskDates";
import { taskPointCeiling, maxBonusFor } from "@/constants/points.constants";
import { fetchPointsConfig } from "@/services/leaderboardService";
import { fetchModules } from "@/services/projectService";

const STATUSES = ["todo", "in_progress", "review", "testing", "client_review", "completed", "blocked"];
const PRIORITIES = ["low", "medium", "high"];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const fmtTime = (t) => t || "—";

const fmtDuration = (ms) => {
  if (!ms || ms < 60000) return "< 1m";
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const STATUS_LABELS = {
  todo: "To do",
  in_progress: "In progress",
  review: "Review",
  testing: "Testing",
  client_review: "Client review",
  blocked: "Blocked",
};

export default function TaskDrawer({ task: taskStub, onClose, directory = [] }) {
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [comment, setComment] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [apiError, setApiError] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editText, setEditText] = useState("");
  const [startTimeDraft, setStartTimeDraft] = useState("");
  const [endTimeDraft, setEndTimeDraft] = useState("");
  const [actualHoursDraft, setActualHoursDraft] = useState("");
  const [bonusPointsDraft, setBonusPointsDraft] = useState("");

  const open = Boolean(taskStub);
  const { data: task } = useQuery({
    queryKey: ["task", taskStub?._id],
    queryFn: () => fetchTask(taskStub._id),
    enabled: open,
  });

  const { data: pointsConfig } = useQuery({
    queryKey: ["points-config"],
    queryFn: fetchPointsConfig,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const projectId = task?.project?._id;
  const { data: projectModules = [] } = useQuery({
    queryKey: ["modules", projectId],
    queryFn: () => fetchModules(projectId),
    enabled: open && Boolean(projectId),
  });

  useEffect(() => {
    setStartTimeDraft(task?.startTime || "");
    setEndTimeDraft(task?.endTime || "");
  }, [task?._id, task?.startTime, task?.endTime]);

  useEffect(() => {
    setActualHoursDraft(task?.actualHours ?? "");
  }, [task?._id, task?.actualHours]);

  useEffect(() => {
    setBonusPointsDraft(task?.bonusPoints ?? 0);
  }, [task?._id, task?.bonusPoints]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["task", taskStub?._id] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    if (task?.project?._id) queryClient.invalidateQueries({ queryKey: ["project", task.project._id] });
    if (task?.project?._id) queryClient.invalidateQueries({ queryKey: ["modules", task.project._id] });
  };

  const showError = (e) => {
    const message = e.response?.data?.message || "Something went wrong";
    setApiError(message);
    toast.error(message);
  };

  // No success toast here — patch backs frequent inline edits (status,
  // priority, assignees, subtask ticks) where the UI already updates in
  // place; a toast per click would be noise, not feedback.
  const patch = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: (payload) => updateTask({ id: taskStub._id, ...payload }),
    onSuccess: invalidate,
    onError: showError,
  });

  const commentMutation = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: () => addComment({ id: taskStub._id, text: comment }),
    onSuccess: () => {
      setComment("");
      invalidate();
      toast.success("Comment added");
    },
    onError: showError,
  });

  const editComment = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: ({ commentId, text }) => updateComment({ id: taskStub._id, commentId, text }),
    onSuccess: () => {
      setEditingCommentId(null);
      invalidate();
      toast.success("Comment updated");
    },
    onError: showError,
  });

  const removeComment = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: (commentId) => deleteComment({ id: taskStub._id, commentId }),
    onSuccess: () => {
      invalidate();
      toast.success("Comment deleted");
    },
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: () => deleteTask(taskStub._id),
    onSuccess: () => {
      invalidate();
      toast.success("Task deleted");
      onClose();
    },
    onError: showError,
  });

  if (!open) return null;

  const isAssignee = task?.assignees?.some((a) => a._id === me?._id);
  const canManage = ["admin", "manager", "subadmin", "sublead"].includes(me?.role);
  const canEditStatus = canManage || isAssignee;
  // Comment moderation is deliberately narrower than canManage: backend's
  // COMMENT_MODERATOR_ROLES excludes subadmin (no project-scope check there).
  const canModerateComments = ["admin", "manager", "sublead"].includes(me?.role);

  const toggleSubtask = (index) => {
    const subtasks = task.subtasks.map((s, i) => (i === index ? { ...s, done: !s.done } : s));
    patch.mutate({ subtasks });
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    patch.mutate({ subtasks: [...(task.subtasks || []), { title: newSubtask.trim(), done: false }] });
    setNewSubtask("");
  };

  const removeSubtask = (index) => {
    patch.mutate({ subtasks: task.subtasks.filter((_, i) => i !== index) });
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
          <p className="text-xs text-muted">
            Project: <span className="font-medium text-primary">{task.project?.name || "—"}</span>
          </p>

          {apiError && (
            <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {apiError}
            </p>
          )}

          {task.recurrence && (
            <p className="text-xs text-muted">
              <Badge value={`Repeats: ${task.recurrence.frequency}`} tone="info" />
            </p>
          )}

          {task.type === "bug" && (
            <div className="flex items-center gap-2">
              <Badge value="bug" />
              {task.reference && <p className="text-xs text-muted">Reference: {task.reference}</p>}
            </div>
          )}

          {canManage ? (
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary"
                checked={Boolean(task.isClientChange)}
                disabled={patch.isPending}
                onChange={(e) => patch.mutate({ isClientChange: e.target.checked })}
              />
              Client requested this change
            </label>
          ) : (
            task.isClientChange && <Badge value="client change" tone="info" />
          )}

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <p className="text-xs text-muted">
            Worth up to{" "}
            <span className="font-medium text-primary">{taskPointCeiling(task.priority, pointsConfig?.pointsByPriority)} pts</span> on
            the leaderboard
          </p>

          <MultiSelect
            label="Assignees"
            items={directory}
            value={(task.assignees || []).map((a) => a._id)}
            disabled={!canManage || patch.isPending}
            onChange={(assignees) => patch.mutate({ assignees })}
            placeholder="Select assignees…"
          />

          <MultiSelect
            label="Modules"
            items={projectModules}
            value={(task.modules || []).map((m) => m._id || m)}
            disabled={!canManage || patch.isPending}
            onChange={(modules) => patch.mutate({ modules })}
            placeholder="None"
          />

          {task.blockedBy?.length > 0 && (
            <div>
              <p className="text-sm font-medium">Blocked by</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {task.blockedBy.map((b) => (
                  <span
                    key={b._id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs"
                  >
                    {b.title}
                    <Badge value={b.status} />
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 rounded-card border border-border bg-background/60 p-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Deadline</p>
              <p className="mt-0.5 flex items-center gap-1.5 font-medium tabular-nums">
                {fmtDate(task.deadline)}
                {(task.startTime || task.endTime) && (
                  <span className="text-xs font-normal text-muted">
                    {fmtTime(task.startTime)}–{fmtTime(task.endTime)}
                  </span>
                )}
                {isTaskOverdue(task) && <Badge value="overdue" tone="danger" />}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Estimated</p>
              <p className="mt-0.5 font-medium tabular-nums">{task.estimatedHours ?? "—"}h</p>
            </div>
            <div>
              <p className="text-xs text-muted">Actual</p>
              {canEditStatus ? (
                <input
                  aria-label="Actual hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={actualHoursDraft}
                  disabled={patch.isPending}
                  onChange={(e) => setActualHoursDraft(e.target.value)}
                  onBlur={() => {
                    const value = actualHoursDraft === "" ? null : Number(actualHoursDraft);
                    if (value !== (task.actualHours ?? null)) patch.mutate({ actualHours: value });
                  }}
                  className="mt-0.5 w-20 rounded-input border border-border bg-surface px-2 py-1 text-sm font-medium tabular-nums outline-none transition-colors duration-150 focus:border-primary disabled:opacity-50"
                />
              ) : (
                <p className="mt-0.5 font-medium tabular-nums">{task.actualHours ?? "—"}h</p>
              )}
            </div>
          </div>

          {canManage && (
            <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-background/60 p-4">
              <div>
                <label htmlFor="task-start-time" className="text-xs text-muted">
                  Start time
                </label>
                <input
                  id="task-start-time"
                  type="time"
                  value={startTimeDraft}
                  onChange={(e) => setStartTimeDraft(e.target.value)}
                  className="mt-1 block rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="task-end-time" className="text-xs text-muted">
                  End time
                </label>
                <input
                  id="task-end-time"
                  type="time"
                  value={endTimeDraft}
                  onChange={(e) => setEndTimeDraft(e.target.value)}
                  className="mt-1 block rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
                />
              </div>
              <Button
                variant="secondary"
                disabled={
                  patch.isPending ||
                  (startTimeDraft === (task.startTime || "") && endTimeDraft === (task.endTime || ""))
                }
                onClick={() => patch.mutate({ startTime: startTimeDraft || null, endTime: endTimeDraft || null })}
              >
                Save time slot
              </Button>
            </div>
          )}

          {canManage && task.status === "completed" && (
            <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-background/60 p-4">
              <div>
                <label htmlFor="task-bonus-points" className="text-xs text-muted">
                  Bonus points (0–{maxBonusFor(task.priority, pointsConfig?.pointsByPriority)})
                </label>
                <input
                  id="task-bonus-points"
                  type="number"
                  min="0"
                  max={maxBonusFor(task.priority, pointsConfig?.pointsByPriority)}
                  step="1"
                  value={bonusPointsDraft}
                  onChange={(e) => setBonusPointsDraft(e.target.value)}
                  className="mt-1 block w-24 rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
                />
              </div>
              <Button
                variant="secondary"
                disabled={patch.isPending || Number(bonusPointsDraft) === (task.bonusPoints ?? 0)}
                onClick={() => patch.mutate({ bonusPoints: Number(bonusPointsDraft) || 0 })}
              >
                Award bonus
              </Button>
            </div>
          )}

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
                <li key={s._id || i} className="flex items-center gap-2 rounded-btn px-2 py-1.5 hover:bg-background">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={s.done}
                      disabled={!canEditStatus || patch.isPending}
                      onChange={() => toggleSubtask(i)}
                      className="accent-primary"
                    />
                    <span className={s.done ? "text-muted line-through" : ""}>{s.title}</span>
                  </label>
                  {canEditStatus && (
                    <button
                      type="button"
                      aria-label="Delete subtask"
                      onClick={() => removeSubtask(i)}
                      disabled={patch.isPending}
                      className="text-muted transition-colors duration-150 hover:text-danger disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  )}
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

          {task.statusDurations && Object.keys(task.statusDurations).length > 0 && (
            <section>
              <h3 className="text-sm font-semibold">Time in status</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {Object.entries(task.statusDurations).map(([status, ms]) => (
                  <li key={status} className="flex items-center justify-between text-muted">
                    <span>
                      {STATUS_LABELS[status] || status}
                      {status === task.status && task.status !== "completed" ? " (ongoing)" : ""}
                    </span>
                    <span className="tabular-nums">{fmtDuration(ms)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm font-medium">
                <span>Total working time</span>
                <span className="tabular-nums text-primary">{fmtDuration(task.totalWorkingMs)}</span>
              </p>
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold">Comments</h3>
            <ul className="mt-2 space-y-3">
              {(task.comments || []).map((c) => {
                const isOwn = c.user?._id === me?._id;
                const canEdit = isOwn || canModerateComments;
                const canDelete = isOwn || me?.role === "admin";
                const isEditing = editingCommentId === c._id;
                return (
                  <li key={c._id} className="rounded-card border border-border/60 bg-background/60 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-muted">
                        <span className="font-medium text-primary">{c.user?.name || "Someone"}</span> ·{" "}
                        {new Date(c.createdAt).toLocaleString()}
                      </p>
                      {!isEditing && (canEdit || canDelete) && (
                        <div className="flex shrink-0 gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              aria-label="Edit comment"
                              onClick={() => {
                                setEditingCommentId(c._id);
                                setEditText(c.text);
                              }}
                              className="text-muted transition-colors duration-150 hover:text-primary"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              aria-label="Delete comment"
                              onClick={() => {
                                if (window.confirm("Delete this comment?")) removeComment.mutate(c._id);
                              }}
                              disabled={removeComment.isPending}
                              className="text-muted transition-colors duration-150 hover:text-danger disabled:opacity-50"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="mt-1.5 space-y-2">
                        <textarea
                          aria-label="Edit comment text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={2}
                          className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => setEditingCommentId(null)}
                            disabled={editComment.isPending}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => editComment.mutate({ commentId: c._id, text: editText })}
                            disabled={!editText.trim() || editComment.isPending}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 whitespace-pre-wrap text-sm">{c.text}</p>
                    )}
                  </li>
                );
              })}
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

          {me?.role === "admin" && (
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Delete task "${task.title}"? This cannot be undone.`)) {
                  remove.mutate();
                }
              }}
            >
              <Trash2 size={15} /> Delete task
            </Button>
          )}
        </div>
      )}
    </Drawer>
  );
}
