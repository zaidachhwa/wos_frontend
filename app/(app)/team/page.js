"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Search, Plus } from "lucide-react";

import UserTable from "@/components/team/UserTable";
import UserDialog from "@/components/team/UserDialog";
import OrgStructure from "@/components/team/OrgStructure";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Field";
import { useAuthStore } from "@/store/authStore";
import { fetchUsers, fetchDirectory, fetchDepartments, fetchTeams, deleteUser } from "@/services/orgService";

export default function TeamPage() {
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === "admin";
  const canManageTeam = isAdmin || me?.role === "subadmin";
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("people");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [dialogUser, setDialogUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: canManageTeam ? ["users"] : ["directory"],
    queryFn: canManageTeam ? fetchUsers : fetchDirectory,
  });

  const removeUser = useMutation({
    mutationFn: deleteUser,
    onMutate: () => setDeleteError(""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["directory"] });
    },
    onError: (e) => setDeleteError(e.response?.data?.message || "Something went wrong"),
  });
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: fetchDepartments });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });

  const filtered = useMemo(() => {
    let list = users || [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) => u.name.toLowerCase().includes(q) || (u.designation || "").toLowerCase().includes(q)
      );
    }
    if (roleFilter) list = list.filter((u) => u.role === roleFilter);
    return list;
  }, [users, search, roleFilter]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {canManageTeam ? (
          <div className="flex gap-1 rounded-btn border border-border bg-surface p-1">
            {[
              ["people", "People"],
              ["structure", "Departments & Teams"],
            ].map(([key, label]) => (
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
        ) : (
          <p className="text-sm text-muted">Directory of your organization.</p>
        )}

        {tab === "people" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                aria-label="Search people"
                placeholder="Search people…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56 rounded-input border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none transition-colors duration-150 focus:border-primary"
              />
            </div>
            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
            >
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="sublead">Sub Lead</option>
              <option value="member">Member</option>
            </select>
            {canManageTeam && (
              <Button
                onClick={() => {
                  setDialogUser(null);
                  setDialogOpen(true);
                }}
              >
                <Plus size={16} /> New user
              </Button>
            )}
          </div>
        )}
      </div>

      {deleteError && (
        <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {deleteError}
        </p>
      )}

      {tab === "people" ? (
        isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : filtered.length ? (
          <UserTable
            users={filtered}
            canEdit={canManageTeam}
            onEdit={(u) => {
              setDialogUser(u);
              setDialogOpen(true);
            }}
            onDelete={(u) => {
              if (window.confirm(`Delete ${u.name}? They'll be deactivated and lose access to WorkOS.`)) {
                removeUser.mutate(u._id);
              }
            }}
          />
        ) : (
          <EmptyState
            icon={Users}
            heading={search || roleFilter ? "No people match your filters" : "No people yet"}
            description={
              canManageTeam ? "Create your first user to start building the organization." : undefined
            }
            action={
              canManageTeam && !search && !roleFilter ? (
                <Button
                  onClick={() => {
                    setDialogUser(null);
                    setDialogOpen(true);
                  }}
                >
                  <Plus size={16} /> Create user
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <OrgStructure departments={departments} teams={teams} me={me} />
      )}

      {canManageTeam && (
        <UserDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          user={dialogUser}
          directory={users || []}
          departments={departments}
          teams={teams}
        />
      )}
    </div>
  );
}
