"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { List } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

import KanbanCard from "@/components/kanban/KanbanCard";
import ProjectKanbanCard from "@/components/kanban/ProjectKanbanCard";
import ModuleKanbanCard from "@/components/kanban/ModuleKanbanCard";
import TaskDrawer from "@/components/tasks/TaskDrawer";
import ModuleDialog from "@/components/projects/ModuleDialog";
import Skeleton from "@/components/ui/Skeleton";
import { fetchTasks, updateTask } from "@/services/taskService";
import { fetchProjects, fetchModules, updateProject, updateModule } from "@/services/projectService";
import { fetchDirectory } from "@/services/orgService";

const COLUMNS = [
  ["backlog", "Backlog"],
  ["todo", "To Do"],
  ["in_progress", "In Progress"],
  ["review", "Review"],
  ["testing", "Testing"],
  ["completed", "Completed"],
  ["blocked", "Blocked"],
];

const PROJECT_STATUSES = [
  ["planning", "Planning"],
  ["active", "Active"],
  ["on_hold", "On Hold"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
];

const TABS = [
  ["tasks", "Tasks"],
  ["projects", "Projects"],
  ["modules", "Modules"],
];

// Shared board renderer for the Projects/Modules tabs — same column/drag
// markup as the Tasks board below, just generic over status + card renderer.
function StatusBoard({ statuses, items, renderCard, onDragEnd }) {
  const byStatus = (status) => items.filter((item) => item.status === status);
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {statuses.map(([status, label]) => {
          const colItems = byStatus(status);
          return (
            <Droppable droppableId={status} key={status}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex w-72 shrink-0 flex-col rounded-card border border-border p-3 transition-colors duration-150 ${
                    snapshot.isDraggingOver ? "border-info/40 bg-info/5" : "bg-background/60"
                  }`}
                >
                  <p className="flex items-center justify-between px-1 pb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    {label}
                    <span className="rounded-full bg-border/60 px-2 py-0.5 tabular-nums">{colItems.length}</span>
                  </p>
                  <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                    {colItems.map((item, index) => (
                      <Draggable
                        draggableId={item._id}
                        index={index}
                        key={item._id}
                        disableInteractiveElementBlocking
                      >
                        {(drag, dragSnapshot) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            {...drag.dragHandleProps}
                            className={dragSnapshot.isDragging ? "rounded-card shadow-md ring-2 ring-info/30" : ""}
                          >
                            {renderCard(item)}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}

export default function KanbanPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("tasks");

  // Shared across tabs: project filter dropdown (Tasks tab), Projects board,
  // and the project picker for the Modules tab.
  const { data: projects = [], isLoading: projectsLoading } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: directory = [] } = useQuery({ queryKey: ["directory"], queryFn: fetchDirectory });

  // --- Tasks tab state (unchanged behavior) ---
  const [scope, setScope] = useState("me");
  const [projectFilter, setProjectFilter] = useState("");
  const [openTask, setOpenTask] = useState(null);
  const [error, setError] = useState("");

  const filters = { assignee: scope === "me" ? "me" : undefined, project: projectFilter || undefined };
  const queryKey = ["tasks", "kanban", filters];
  const { data: tasks, isLoading } = useQuery({ queryKey, queryFn: () => fetchTasks(filters) });

  const move = useMutation({
    mutationFn: ({ id, status }) => updateTask({ id, status }),
    onMutate: async ({ id, status }) => {
      setError("");
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old) =>
        (old || []).map((t) => (t._id === id ? { ...t, status } : t))
      );
      return { previous };
    },
    onError: (e, _vars, context) => {
      queryClient.setQueryData(queryKey, context.previous);
      setError(e.response?.data?.message || "Could not move task");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const onDragEnd = ({ draggableId, destination, source }) => {
    if (!destination || destination.droppableId === source.droppableId) return;
    move.mutate({ id: draggableId, status: destination.droppableId });
  };

  const byStatus = (status) => (tasks || []).filter((t) => t.status === status);

  // --- Projects tab state ---
  const [projectError, setProjectError] = useState("");

  const moveProject = useMutation({
    mutationFn: ({ id, status }) => updateProject({ id, status }),
    onMutate: async ({ id, status }) => {
      setProjectError("");
      await queryClient.cancelQueries({ queryKey: ["projects"] });
      const previous = queryClient.getQueryData(["projects"]);
      queryClient.setQueryData(["projects"], (old) =>
        (old || []).map((p) => (p._id === id ? { ...p, status } : p))
      );
      return { previous };
    },
    onError: (e, _vars, context) => {
      queryClient.setQueryData(["projects"], context.previous);
      setProjectError(e.response?.data?.message || "Could not move project");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  const onProjectDragEnd = ({ draggableId, destination, source }) => {
    if (!destination || destination.droppableId === source.droppableId) return;
    moveProject.mutate({ id: draggableId, status: destination.droppableId });
  };

  // --- Modules tab state ---
  const [moduleProjectId, setModuleProjectId] = useState("");
  const [moduleError, setModuleError] = useState("");
  const [moduleDialog, setModuleDialog] = useState({ open: false, module: null });

  // Defaults to the first project once loaded, without needing an effect.
  const selectedProjectId = moduleProjectId || projects[0]?._id || "";

  const modulesQueryKey = ["modules", selectedProjectId];
  const { data: modules = [], isLoading: modulesLoading } = useQuery({
    queryKey: modulesQueryKey,
    queryFn: () => fetchModules(selectedProjectId),
    enabled: tab === "modules" && Boolean(selectedProjectId),
  });

  const moveModule = useMutation({
    mutationFn: ({ id, status }) => updateModule({ projectId: selectedProjectId, moduleId: id, status }),
    onMutate: async ({ id, status }) => {
      setModuleError("");
      await queryClient.cancelQueries({ queryKey: modulesQueryKey });
      const previous = queryClient.getQueryData(modulesQueryKey);
      queryClient.setQueryData(modulesQueryKey, (old) =>
        (old || []).map((m) => (m._id === id ? { ...m, status } : m))
      );
      return { previous };
    },
    onError: (e, _vars, context) => {
      queryClient.setQueryData(modulesQueryKey, context.previous);
      setModuleError(e.response?.data?.message || "Could not move module");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: modulesQueryKey });
      queryClient.invalidateQueries({ queryKey: ["project", selectedProjectId] });
    },
  });

  const onModuleDragEnd = ({ draggableId, destination, source }) => {
    if (!destination || destination.droppableId === source.droppableId) return;
    moveModule.mutate({ id: draggableId, status: destination.droppableId });
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex w-fit gap-1 rounded-btn border border-border bg-surface p-1">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              tab === key ? "bg-primary text-primary-foreground" : "text-muted hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "tasks" && (
        <>
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
            {error && (
              <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-1.5 text-sm text-danger">
                {error}
              </p>
            )}
            <Link
              href="/tasks"
              className="ml-auto flex items-center gap-1.5 rounded-btn border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 hover:text-primary"
            >
              <List size={15} /> List
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-72 w-full rounded-card" />
              ))}
            </div>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
                {COLUMNS.map(([status, label]) => {
                  const items = byStatus(status);
                  return (
                    <Droppable droppableId={status} key={status}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex w-72 shrink-0 flex-col rounded-card border border-border p-3 transition-colors duration-150 ${
                            snapshot.isDraggingOver ? "border-info/40 bg-info/5" : "bg-background/60"
                          }`}
                        >
                          <p className="flex items-center justify-between px-1 pb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                            {label}
                            <span className="rounded-full bg-border/60 px-2 py-0.5 tabular-nums">{items.length}</span>
                          </p>
                          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                            {items.map((task, index) => (
                              // The whole card is a <button>, and dnd blocks drags that
                              // start on interactive elements unless told otherwise.
                              <Draggable
                                draggableId={task._id}
                                index={index}
                                key={task._id}
                                disableInteractiveElementBlocking
                              >
                                {(drag, snapshot) => (
                                  <div
                                    ref={drag.innerRef}
                                    {...drag.draggableProps}
                                    {...drag.dragHandleProps}
                                    className={
                                      snapshot.isDragging
                                        ? "rounded-card shadow-md ring-2 ring-info/30"
                                        : ""
                                    }
                                  >
                                    <KanbanCard task={task} onOpen={() => setOpenTask(task)} />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        </div>
                      )}
                    </Droppable>
                  );
                })}
              </div>
            </DragDropContext>
          )}

          <TaskDrawer task={openTask} onClose={() => setOpenTask(null)} directory={directory} />
        </>
      )}

      {tab === "projects" && (
        <>
          {projectError && (
            <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-1.5 text-sm text-danger">
              {projectError}
            </p>
          )}
          {projectsLoading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-72 w-full rounded-card" />
              ))}
            </div>
          ) : (
            <StatusBoard
              statuses={PROJECT_STATUSES}
              items={projects}
              renderCard={(project) => <ProjectKanbanCard project={project} />}
              onDragEnd={onProjectDragEnd}
            />
          )}
        </>
      )}

      {tab === "modules" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Select project"
              value={selectedProjectId}
              onChange={(e) => setModuleProjectId(e.target.value)}
              className="rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
            >
              {!projects.length && <option value="">No projects</option>}
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
            {moduleError && (
              <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-1.5 text-sm text-danger">
                {moduleError}
              </p>
            )}
          </div>

          {modulesLoading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-72 w-full rounded-card" />
              ))}
            </div>
          ) : (
            <StatusBoard
              statuses={PROJECT_STATUSES}
              items={modules}
              renderCard={(m) => <ModuleKanbanCard module={m} onOpen={() => setModuleDialog({ open: true, module: m })} />}
              onDragEnd={onModuleDragEnd}
            />
          )}

          <ModuleDialog
            open={moduleDialog.open}
            onClose={() => setModuleDialog({ open: false, module: null })}
            projectId={selectedProjectId}
            module={moduleDialog.module}
            directory={directory}
          />
        </>
      )}
    </div>
  );
}
