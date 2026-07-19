"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban, Plus } from "lucide-react";

import ProjectCard from "@/components/projects/ProjectCard";
import ProjectDialog from "@/components/projects/ProjectDialog";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import Pagination from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Field";
import { useAuthStore } from "@/store/authStore";
import { fetchProjectsPage } from "@/services/projectService";
import { fetchDirectory } from "@/services/orgService";

const PAGE_SIZE = 12;

export default function ProjectsPage() {
  const me = useAuthStore((s) => s.user);
  const canCreate = ["admin", "manager"].includes(me?.role);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["projects", { page, limit: PAGE_SIZE, status: statusFilter }],
    queryFn: () => fetchProjectsPage({ page, limit: PAGE_SIZE, status: statusFilter }),
    placeholderData: (prev) => prev,
  });
  const { data: directory = [] } = useQuery({ queryKey: ["directory"], queryFn: fetchDirectory });

  const projects = data?.projects || [];
  const pagination = data?.pagination;

  const changeStatusFilter = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => changeStatusFilter(e.target.value)}
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
      ) : projects.length ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p._id} project={p} />
            ))}
          </div>
          <Pagination page={pagination?.page || page} totalPages={pagination?.totalPages || 1} total={pagination?.total} onPageChange={setPage} />
        </>
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
