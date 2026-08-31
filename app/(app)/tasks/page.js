"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Columns3, Plus } from "lucide-react";

import TaskTable from "@/components/tasks/TaskTable";
import TaskDrawer from "@/components/tasks/TaskDrawer";
import TaskDialog from "@/components/tasks/TaskDialog";
import ApprovalQueue from "@/components/tasks/ApprovalQueue";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import MultiSelect from "@/components/ui/MultiSelect";
import { Button } from "@/components/ui/Field";
import { useAuthStore } from "@/store/authStore";
import { fetchTasks, bulkUpdateTasks } from "@/services/taskService";
import { fetchProjects } from "@/services/projectService";
import { fetchDirectory } from "@/services/orgService";
import useToast from "@/hooks/useToast";
import { isTaskOverdue } from "@/lib/taskDates";

const STATUSES = ["todo", "in_progress", "review", "testing", "client_review", "completed", "blocked"];

const startOfDay = (offset = 0) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
};

const bucketOf = (t) => {
  if (!t.deadline) return "No deadline";
  const dl = new Date(t.deadline);
  if (isTaskOverdue(t)) return "Overdue";
  if (dl < startOfDay(1)) return "Today";
  return "Upcoming";
};
const BUCKET_ORDER = ["Overdue", "Today", "Upcoming", "No deadline"];

export default function TasksPage() {
  const me = useAuthStore((s) => s.user);
  const canCreate = ["admin", "manager", "subadmin", "sublead", "member", "director"].includes(me?.role);
  const canBulk = ["admin", "manager", "subadmin", "sublead"].includes(me?.role);
  const canApprove = ["admin", "manager", "subadmin", "sublead"].includes(me?.role);
  const isDirector = me?.role === "director";
  const queryClient = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scope, setScope] = useState(isDirector ? "me" : "me");
  const [status, setStatus] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [dateTab, setDateTab] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkAssignees, setBulkAssignees] = useState([]);

  const openId = searchParams.get("open");
  const openTask = openId ? { _id: openId } : null;
  const setOpenTask = (task) => router.push(`/tasks?open=${task._id}`);
  const closeTask = () => router.replace("/tasks");

  const filters = {
    assignee: scope === "me" ? "me" : undefined,
    status: status || undefined,
    project: projectFilter || undefined,
    search: search || undefined,
  };
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", filters],
    queryFn: () => fetchTasks(filters),
    enabled: scope !== "approvals",
  });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: directory = [] } = useQuery({ queryKey: ["directory"], queryFn: fetchDirectory });

  const groups = (tasks || [])
    .reduce((acc, t) => {
      const bucket = bucketOf(t);
      (acc[bucket] ||= []).push(t);
      return acc;
    }, {});
  const groupedTasks = BUCKET_ORDER.map((b) => [b, groups[b] || []]).filter(([, list]) => list.length);
  const activeBucket = groupedTasks.some(([b]) => b === dateTab) ? dateTab : groupedTasks[0]?.[0];
  const activeList = groupedTasks.find(([b]) => b === activeBucket)?.[1] || [];

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = (visibleTasks, checked) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const t of visibleTasks) {
        if (checked) next.add(t._id);
        else next.delete(t._id);
      }
      return next;
    });

  const clearSelection = () => {
    setSelected(new Set());
    setBulkStatus("");
    setBulkAssignees([]);
  };

  const bulkMutation = useMutation({
    mutationFn: () =>
      bulkUpdateTasks({
        ids: Array.from(selected),
        status: bulkStatus || undefined,
        assignees: bulkAssignees.length ? bulkAssignees : undefined,
      }),
    onSuccess: (data) => {
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`${data.updated} task${data.updated === 1 ? "" : "s"} updated`);
    },
    onError: (error) => toast.error(error.response?.data?.message || "Something went wrong"),
  });

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-btn border border-border bg-surface p-1">
            {[
              ["me", "My tasks"],
              ...(!isDirector ? [["all", "All visible"]] : []),
              ...(canApprove ? [["approvals", "Approvals"]] : []),
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setScope(key)}
                className={`rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  scope === key ? "bg-primary text-primary-foreground" : "text-muted hover:text-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {scope !== "approvals" && (
            <>
              <select
                aria-label="Filter by project"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                aria-label="Search tasks"
                placeholder="Search tasks…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48 rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
              />
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/tasks/kanban"
            className="flex items-center gap-1.5 rounded-btn border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 hover:text-primary"
          >
            <Columns3 size={15} /> Board
          </Link>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> New task
            </Button>
          )}
        </div>
      </div>

      {scope === "approvals" ? (
        <ApprovalQueue />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 px-0.5">
            <button
              onClick={() => setStatus("")}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors duration-150 ${
                status === "" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:text-primary"
              }`}
            >
              All statuses
            </button>
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s === status ? "" : s)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors duration-150 ${
                  status === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:text-primary"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-card" />
          ) : tasks?.length ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1 rounded-btn border border-border bg-surface p-1">
                {groupedTasks.map(([bucket, list]) => (
                  <button
                    key={bucket}
                    onClick={() => setDateTab(bucket)}
                    className={`rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                      activeBucket === bucket ? "bg-primary text-primary-foreground" : "text-muted hover:text-primary"
                    }`}
                  >
                    {bucket} <span className="tabular-nums">({list.length})</span>
                  </button>
                ))}
              </div>

              {canBulk && selected.size > 0 && (
                <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-card border border-primary/30 bg-primary/5 p-3">
                  <p className="text-sm font-medium">{selected.size} selected</p>
                  <select
                    aria-label="Bulk set status"
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className="rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
                  >
                    <option value="">Status unchanged</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                  <div className="w-56">
                    <MultiSelect
                      ariaLabel="Bulk set assignees"
                      items={directory}
                      value={bulkAssignees}
                      onChange={setBulkAssignees}
                      placeholder="Assignees unchanged"
                    />
                  </div>
                  <Button
                    onClick={() => bulkMutation.mutate()}
                    disabled={bulkMutation.isPending || (!bulkStatus && !bulkAssignees.length)}
                  >
                    Apply to {selected.size} tasks
                  </Button>
                  <Button variant="secondary" onClick={clearSelection}>
                    Clear
                  </Button>
                  {bulkMutation.isError && (
                    <p className="w-full text-sm text-danger">
                      {bulkMutation.error?.response?.data?.message || "Something went wrong"}
                    </p>
                  )}
                </div>
              )}

              <TaskTable
                tasks={activeList}
                onOpen={setOpenTask}
                selected={canBulk ? selected : undefined}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
              />
            </div>
          ) : (
            <EmptyState
              icon={CheckSquare}
              heading="No tasks found"
              description={scope === "me" ? "Tasks assigned to you will appear here." : "Try changing the filters."}
            />
          )}
        </div>
      )}

      <TaskDrawer task={openTask} onClose={closeTask} directory={directory} />
      {canCreate && (
        <TaskDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          projects={projects}
          directory={isDirector ? directory.filter((u) => u.role === "hr") : directory}
        />
      )}
    </div>
  );
}
