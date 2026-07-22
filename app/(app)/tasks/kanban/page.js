"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { List } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

import KanbanCard from "@/components/kanban/KanbanCard";
import TaskDrawer from "@/components/tasks/TaskDrawer";
import Skeleton from "@/components/ui/Skeleton";
import { fetchTasks, updateTask } from "@/services/taskService";
import { fetchProjects } from "@/services/projectService";
import { fetchDirectory } from "@/services/orgService";

const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const COLUMNS = [
  ["backlog", "Backlog"],
  ["todo", "To Do"],
  ["in_progress", "In Progress"],
  ["review", "Review"],
  ["testing", "Testing"],
  ["completed", "Completed"],
  ["blocked", "Blocked"],
];

export default function TaskKanbanPage() {
  const queryClient = useQueryClient();
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: directory = [] } = useQuery({ queryKey: ["directory"], queryFn: fetchDirectory });

  const [scope, setScope] = useState("me");
  const [projectFilter, setProjectFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(todayStr);
  const [openTask, setOpenTask] = useState(null);
  const [error, setError] = useState("");

  const filters = {
    assignee: scope === "me" ? "me" : undefined,
    project: projectFilter || undefined,
    dueAfter: dateFilter ? `${dateFilter}T00:00:00.000Z` : undefined,
    dueBefore: dateFilter ? `${dateFilter}T23:59:59.999Z` : undefined,
  };
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

  return (
    <div className="flex h-full flex-col space-y-4">
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
        <input
          aria-label="Filter by due date"
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
        />
        {dateFilter && (
          <button
            type="button"
            onClick={() => setDateFilter("")}
            className="text-sm font-medium text-muted transition-colors duration-150 hover:text-primary"
          >
            Clear date
          </button>
        )}
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
    </div>
  );
}
