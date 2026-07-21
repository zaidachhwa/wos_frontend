"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { List, Rows3 } from "lucide-react";

import StatusBoard from "@/components/kanban/StatusBoard";
import ProjectKanbanCard from "@/components/kanban/ProjectKanbanCard";
import Skeleton from "@/components/ui/Skeleton";
import { fetchProjects, updateProject } from "@/services/projectService";
import { PROJECT_STATUSES } from "@/constants/project.constants";

export default function ProjectKanbanPage() {
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
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

  const onDragEnd = ({ draggableId, destination, source }) => {
    if (!destination || destination.droppableId === source.droppableId) return;
    moveProject.mutate({ id: draggableId, status: destination.droppableId });
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center gap-2">
        {projectError && (
          <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-1.5 text-sm text-danger">
            {projectError}
          </p>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/projects/modules-kanban"
            className="flex items-center gap-1.5 rounded-btn border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 hover:text-primary"
          >
            <Rows3 size={15} /> Modules board
          </Link>
          <Link
            href="/projects"
            className="flex items-center gap-1.5 rounded-btn border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 hover:text-primary"
          >
            <List size={15} /> List
          </Link>
        </div>
      </div>

      {isLoading ? (
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
          onDragEnd={onDragEnd}
        />
      )}
    </div>
  );
}
