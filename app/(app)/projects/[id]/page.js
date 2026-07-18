"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";

import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Field";
import ProgressBar from "@/components/shared/ProgressBar";
import ActivityFeed from "@/components/shared/ActivityFeed";
import ProjectDialog from "@/components/projects/ProjectDialog";
import ModuleDialog from "@/components/projects/ModuleDialog";
import HealthCard from "@/components/projects/HealthCard";
import TaskTable from "@/components/tasks/TaskTable";
import TaskDrawer from "@/components/tasks/TaskDrawer";
import TimelineView from "@/components/projects/TimelineView";
import { useAuthStore } from "@/store/authStore";
import { fetchProject, deleteProject } from "@/services/projectService";
import { fetchTasks } from "@/services/taskService";
import { fetchDirectory } from "@/services/orgService";
import { fetchActivity } from "@/services/notificationService";

const TABS = ["overview", "modules", "tasks", "timeline", "activity"];

export default function ProjectDetailsPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [moduleDialog, setModuleDialog] = useState({ open: false, module: null });
  const [openTask, setOpenTask] = useState(null);

  const { data: project, isLoading } = useQuery({ queryKey: ["project", id], queryFn: () => fetchProject(id) });
  const { data: directory = [] } = useQuery({ queryKey: ["directory"], queryFn: fetchDirectory });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", { project: id }],
    queryFn: () => fetchTasks({ project: id }),
    enabled: tab === "tasks" || tab === "timeline",
  });
  const { data: activity = [] } = useQuery({
    queryKey: ["activity", id],
    queryFn: () => fetchActivity({ project: id }),
    enabled: tab === "activity" || tab === "overview",
  });

  const canManage = ["admin", "manager"].includes(me?.role) || project?.manager?._id === me?._id;
  const canManageModules = ["admin", "manager", "sublead"].includes(me?.role);

  const removeProject = useMutation({
    mutationFn: () => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.push("/projects");
    },
  });

  if (isLoading || !project) {
    return (
      <div className="mx-auto max-w-[1600px] space-y-4">
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <header className="rounded-card border border-border bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">{project.name}</h2>
              <Badge value={project.status} />
              <Badge value={project.priority} />
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <CalendarDays size={14} />
              {project.deadline
                ? `Due ${new Date(project.deadline).toLocaleDateString()}`
                : "No deadline"}{" "}
              · Managed by {project.manager?.name || "—"}
            </p>
          </div>
          <div className="flex gap-2">
            {canManage && (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil size={15} /> Edit
              </Button>
            )}
            {me?.role === "admin" && (
              <Button
                variant="danger"
                disabled={removeProject.isPending}
                onClick={() => {
                  if (window.confirm(`Delete project "${project.name}"? Its modules and tasks will be deleted too.`)) {
                    removeProject.mutate();
                  }
                }}
              >
                <Trash2 size={15} /> Delete
              </Button>
            )}
          </div>
        </div>
        <div className="mt-4 max-w-md">
          <ProgressBar value={project.progress} />
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto rounded-btn border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-[8px] px-3 py-1.5 text-sm font-medium capitalize transition-colors duration-150 ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted hover:text-primary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="rounded-card border border-border bg-surface p-6 lg:col-span-2">
            <h3 className="text-base font-semibold tracking-tight">About</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
              {project.description || "No description provided."}
            </p>
            <h3 className="mt-6 text-base font-semibold tracking-tight">Recent activity</h3>
            <div className="mt-2">
              <ActivityFeed activities={activity.slice(0, 6)} />
            </div>
          </section>
          <div className="space-y-6">
          <HealthCard projectId={id} />
          <section className="rounded-card border border-border bg-surface p-6">
            <h3 className="text-base font-semibold tracking-tight">Members</h3>
            <ul className="mt-3 space-y-2">
              {(project.members || []).map((m) => (
                <li key={m._id} className="flex items-center gap-3 text-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold uppercase text-muted">
                    {m.name?.slice(0, 2)}
                  </span>
                  <span>
                    <span className="font-medium">{m.name}</span>
                    <span className="block text-xs capitalize text-muted">{m.designation || m.role}</span>
                  </span>
                </li>
              ))}
              {!project.members?.length && <li className="text-sm text-muted">No members yet.</li>}
            </ul>
          </section>
          </div>
        </div>
      )}

      {tab === "modules" && (
        <div className="space-y-4">
          {canManageModules && (
            <div className="flex justify-end">
              <Button onClick={() => setModuleDialog({ open: true, module: null })}>
                <Plus size={16} /> New module
              </Button>
            </div>
          )}
          {project.modules?.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {project.modules.map((m) => (
                <div key={m._id} className="rounded-card border border-border bg-surface p-6">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold">{m.name}</p>
                    <div className="flex items-center gap-1">
                      <Badge value={m.status} />
                      {canManageModules && (
                        <button
                          onClick={() => setModuleDialog({ open: true, module: m })}
                          aria-label={`Edit ${m.name}`}
                          className="rounded-btn p-1 text-muted transition-colors duration-150 hover:bg-background hover:text-primary"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{m.description || "No description."}</p>
                  <div className="mt-4">
                    <ProgressBar value={m.progress} />
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    {m.taskCount ?? 0} tasks · {m.deadline ? `due ${new Date(m.deadline).toLocaleDateString()}` : "no deadline"}
                  </p>
                  {m.assignees?.length > 0 && (
                    <p className="mt-1 truncate text-xs text-muted">
                      Assigned: {m.assignees.map((a) => a.name).join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ClipboardList}
              heading="No modules yet"
              description="Break the project into modules to organize tasks."
            />
          )}
        </div>
      )}

      {tab === "tasks" &&
        (tasks.length ? (
          <TaskTable tasks={tasks} onOpen={setOpenTask} />
        ) : (
          <EmptyState icon={ClipboardList} heading="No tasks in this project yet" />
        ))}

      {tab === "timeline" && <TimelineView project={project} tasks={tasks} />}

      {tab === "activity" && (
        <div className="rounded-card border border-border bg-surface p-6">
          <ActivityFeed activities={activity} />
        </div>
      )}

      <ProjectDialog open={editOpen} onClose={() => setEditOpen(false)} project={project} directory={directory} />
      <ModuleDialog
        open={moduleDialog.open}
        onClose={() => setModuleDialog({ open: false, module: null })}
        projectId={id}
        module={moduleDialog.module}
        directory={directory}
      />
      <TaskDrawer task={openTask} onClose={() => setOpenTask(null)} directory={directory} project={project} />
    </div>
  );
}
