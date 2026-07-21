"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { List } from "lucide-react";

import StatusBoard from "@/components/kanban/StatusBoard";
import ModuleKanbanCard from "@/components/kanban/ModuleKanbanCard";
import ModuleDialog from "@/components/projects/ModuleDialog";
import Skeleton from "@/components/ui/Skeleton";
import { fetchProjects, fetchModules, updateModule } from "@/services/projectService";
import { fetchDirectory } from "@/services/orgService";
import { PROJECT_STATUSES } from "@/constants/project.constants";

export default function ModuleKanbanPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: directory = [] } = useQuery({ queryKey: ["directory"], queryFn: fetchDirectory });

  const [moduleProjectId, setModuleProjectId] = useState("");
  const [moduleError, setModuleError] = useState("");
  const [moduleDialog, setModuleDialog] = useState({ open: false, module: null });

  // Preselects the project passed via ?project=<id> (e.g. from a project's
  // Modules tab); otherwise defaults to the first project once loaded.
  const selectedProjectId = moduleProjectId || searchParams.get("project") || projects[0]?._id || "";

  const modulesQueryKey = ["modules", selectedProjectId];
  const { data: modules = [], isLoading: modulesLoading } = useQuery({
    queryKey: modulesQueryKey,
    queryFn: () => fetchModules(selectedProjectId),
    enabled: Boolean(selectedProjectId),
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

  const onDragEnd = ({ draggableId, destination, source }) => {
    if (!destination || destination.droppableId === source.droppableId) return;
    moveModule.mutate({ id: draggableId, status: destination.droppableId });
  };

  return (
    <div className="flex h-full flex-col space-y-4">
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
        <Link
          href="/projects"
          className="ml-auto flex items-center gap-1.5 rounded-btn border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 hover:text-primary"
        >
          <List size={15} /> List
        </Link>
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
          onDragEnd={onDragEnd}
        />
      )}

      <ModuleDialog
        open={moduleDialog.open}
        onClose={() => setModuleDialog({ open: false, module: null })}
        projectId={selectedProjectId}
        module={moduleDialog.module}
        directory={directory}
      />
    </div>
  );
}
