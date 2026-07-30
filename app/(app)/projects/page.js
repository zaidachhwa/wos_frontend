"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Columns3, FolderKanban, Plus } from "lucide-react";

import ProjectCard from "@/components/projects/ProjectCard";
import ProjectDialog from "@/components/projects/ProjectDialog";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import Pagination from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Field";
import { useAuthStore } from "@/store/authStore";
import { fetchProjectsPage } from "@/services/projectService";
import { fetchDirectory, fetchTeams } from "@/services/orgService";
import { PROJECT_STATUSES, PROJECT_TYPES } from "@/constants/project.constants";

const PAGE_SIZE = 12;

export default function ProjectsPage() {
  const me = useAuthStore((s) => s.user);
  const canCreate = ["admin", "manager", "subadmin"].includes(me?.role);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["projects", { page, limit: PAGE_SIZE, status: statusFilter, type: typeFilter, team: teamFilter, search }],
    queryFn: () =>
      fetchProjectsPage({ page, limit: PAGE_SIZE, status: statusFilter, type: typeFilter, team: teamFilter, search }),
    placeholderData: (prev) => prev,
  });
  const { data: directory = [] } = useQuery({ queryKey: ["directory"], queryFn: fetchDirectory });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });

  const projects = data?.projects || [];
  const pagination = data?.pagination;

  const changeStatusFilter = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const changeTypeFilter = (value) => {
    setTypeFilter(value);
    setPage(1);
  };

  const changeTeamFilter = (value) => {
    setTeamFilter(value);
    setPage(1);
  };

  const changeSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Search projects"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => changeSearch(e.target.value)}
            className="w-48 rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
          />
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => changeStatusFilter(e.target.value)}
            className="rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
          >
            <option value="">All statuses</option>
            {PROJECT_STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by type"
            value={typeFilter}
            onChange={(e) => changeTypeFilter(e.target.value)}
            className="rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
          >
            <option value="">All types</option>
            {PROJECT_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by team"
            value={teamFilter}
            onChange={(e) => changeTeamFilter(e.target.value)}
            className="rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
          >
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/projects/kanban"
            className="flex items-center gap-1.5 rounded-btn border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 hover:text-primary"
          >
            <Columns3 size={15} /> Board
          </Link>
          {canCreate && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus size={16} /> New project
            </Button>
          )}
        </div>
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
