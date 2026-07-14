"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckSquare, Columns3, Plus } from "lucide-react";

import TaskTable from "@/components/tasks/TaskTable";
import TaskDrawer from "@/components/tasks/TaskDrawer";
import TaskDialog from "@/components/tasks/TaskDialog";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Field";
import { useAuthStore } from "@/store/authStore";
import { fetchTasks } from "@/services/taskService";
import { fetchProjects } from "@/services/projectService";
import { fetchDirectory } from "@/services/orgService";

const STATUSES = ["backlog", "todo", "in_progress", "review", "testing", "completed", "blocked"];

const startOfDay = (offset = 0) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
};

const bucketOf = (t) => {
  if (!t.deadline) return "No deadline";
  const dl = new Date(t.deadline);
  if (dl < startOfDay(0) && t.status !== "completed") return "Overdue";
  if (dl < startOfDay(1)) return "Today";
  if (dl < startOfDay(8)) return "This week";
  return "Later";
};
const BUCKET_ORDER = ["Overdue", "Today", "This week", "Later", "No deadline"];

export default function TasksPage() {
  const me = useAuthStore((s) => s.user);
  const canCreate = ["admin", "manager", "sublead"].includes(me?.role);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scope, setScope] = useState("me");
  const [status, setStatus] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [dateTab, setDateTab] = useState(null);

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

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-btn border border-border bg-surface p-1">
            {[
              ["me", "My tasks"],
              ["all", "All visible"],
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
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
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
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/kanban"
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
          <TaskTable tasks={activeList} onOpen={setOpenTask} />
        </div>
      ) : (
        <EmptyState
          icon={CheckSquare}
          heading="No tasks found"
          description={scope === "me" ? "Tasks assigned to you will appear here." : "Try changing the filters."}
        />
      )}

      <TaskDrawer task={openTask} onClose={closeTask} directory={directory} />
      {canCreate && (
        <TaskDialog open={createOpen} onClose={() => setCreateOpen(false)} projects={projects} directory={directory} />
      )}
    </div>
  );
}
