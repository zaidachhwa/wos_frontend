"use client";

import { useState } from "react";
import Link from "next/link";
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

export default function TasksPage() {
  const me = useAuthStore((s) => s.user);
  const canCreate = ["admin", "manager", "sublead"].includes(me?.role);
  const [scope, setScope] = useState("me");
  const [status, setStatus] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [search, setSearch] = useState("");
  const [openTask, setOpenTask] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

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
        <TaskTable tasks={tasks} onOpen={setOpenTask} />
      ) : (
        <EmptyState
          icon={CheckSquare}
          heading="No tasks found"
          description={scope === "me" ? "Tasks assigned to you will appear here." : "Try changing the filters."}
        />
      )}

      <TaskDrawer task={openTask} onClose={() => setOpenTask(null)} directory={directory} />
      {canCreate && (
        <TaskDialog open={createOpen} onClose={() => setCreateOpen(false)} projects={projects} directory={directory} />
      )}
    </div>
  );
}
