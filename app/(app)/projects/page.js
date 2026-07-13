"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban, Plus } from "lucide-react";

import ProjectCard from "@/components/projects/ProjectCard";
import ProjectDialog from "@/components/projects/ProjectDialog";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Field";
import { useAuthStore } from "@/store/authStore";
import { fetchProjects } from "@/services/projectService";
import { fetchDirectory } from "@/services/orgService";

export default function ProjectsPage() {
  const me = useAuthStore((s) => s.user);
  const canCreate = ["admin", "manager"].includes(me?.role);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: directory = [] } = useQuery({ queryKey: ["directory"], queryFn: fetchDirectory });

  const filtered = (projects || []).filter((p) => !statusFilter || p.status === statusFilter);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
        >
          <option value="">All statuses</option>
          {["planning", "active", "on_hold", "completed", "cancelled"].map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus size={16} /> New project
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-card" />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard key={p._id} project={p} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderKanban}
          heading={statusFilter ? "No projects with this status" : "No projects created yet"}
          description={canCreate ? "Create your first project to start organizing work." : "Projects you join will appear here."}
          action={
            canCreate && !statusFilter ? (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus size={16} /> Create Project
              </Button>
            ) : undefined
          }
        />
      )}

      {canCreate && (
        <ProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} project={null} directory={directory} />
      )}
    </div>
  );
}
