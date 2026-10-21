"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Search, Plus, Pencil, Trash2, Shield, Users } from "lucide-react";

import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Field";
import RoleDialog from "@/components/team/RoleDialog";
import { fetchRoles, deleteRole } from "@/services/orgService";

const BASE_ROLE_LABELS = {
  member: "Member",
  sublead: "Sub Lead",
  manager: "Manager",
  subadmin: "Sub Admin",
  admin: "Admin",
  hr: "HR",
  qa: "QA",
  director: "Director",
  technical_coordinator: "Technical Coordinator",
  head_of_technical_operations: "Head of Technical Operations",
};

const BASE_ROLE_TONES = {
  admin: "danger",
  head_of_technical_operations: "danger",
  director: "success",
  hr: "info",
  subadmin: "success",
  manager: "info",
  sublead: "warning",
  technical_coordinator: "primary",
  qa: "warning",
  member: "muted",
};

export default function RoleManagement({ departments = [], me }) {
  const isAdmin = me?.role === "admin" || me?.role === "head_of_technical_operations";
  const isHr = me?.role === "hr";
  const canManageRoles = isAdmin || isHr;

  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => fetchRoles(),
  });

  const removeRoleMutation = useMutation({
    onMutate: () => setErrorMessage(""),
    mutationFn: ({ id, force }) => deleteRole(id, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["appraisal-positions"] });
    },
    onError: (err) => {
      setErrorMessage(err.response?.data?.message || "Failed to delete role");
    },
  });

  const handleDelete = (role) => {
    if (role.userCount > 0) {
      const confirmDelete = window.confirm(
        `Role "${role.name}" is currently assigned to ${role.userCount} active employee(s).\n\nAre you sure you want to delete it permanently? Alternatively, you can edit it and set status to Inactive.`
      );
      if (confirmDelete) {
        removeRoleMutation.mutate({ id: role._id, force: true });
      }
    } else {
      if (window.confirm(`Are you sure you want to delete role "${role.name}"?`)) {
        removeRoleMutation.mutate({ id: role._id, force: false });
      }
    }
  };

  const filteredRoles = useMemo(() => {
    let list = roles || [];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q)
      );
    }

    if (deptFilter) {
      if (deptFilter === "org-wide") {
        list = list.filter((r) => !r.department);
      } else {
        list = list.filter((r) => String(r.department?._id || r.department) === deptFilter);
      }
    }

    if (statusFilter) {
      const isActive = statusFilter === "active";
      list = list.filter((r) => r.isActive === isActive);
    }

    return list;
  }, [roles, search, deptFilter, statusFilter]);

  const activeCount = roles.filter((r) => r.isActive).length;
  const totalAssignedUsers = roles.reduce((sum, r) => sum + (r.userCount || 0), 0);

  return (
    <div className="space-y-5">
      {/* Top action & filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              aria-label="Search roles"
              placeholder="Search roles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 rounded-input border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none transition-colors duration-150 focus:border-primary"
            />
          </div>

          <select
            aria-label="Filter by department"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
          >
            <option value="">All scopes</option>
            <option value="org-wide">Org-wide only</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
          >
            <option value="">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </div>

        {canManageRoles && (
          <Button
            onClick={() => {
              setEditingRole(null);
              setDialogOpen(true);
            }}
          >
            <Plus size={16} /> New Role
          </Button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-border bg-surface p-3">
          <p className="text-xs text-muted font-medium uppercase tracking-wider">Total Roles</p>
          <p className="mt-1 text-2xl font-semibold">{roles.length}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-3">
          <p className="text-xs text-muted font-medium uppercase tracking-wider">Active Roles</p>
          <p className="mt-1 text-2xl font-semibold text-success">{activeCount}</p>
        </div>
        <div className="col-span-2 rounded-card border border-border bg-surface p-3 sm:col-span-1">
          <p className="text-xs text-muted font-medium uppercase tracking-wider">Assigned Members</p>
          <p className="mt-1 text-2xl font-semibold text-primary">{totalAssignedUsers}</p>
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {errorMessage}
        </p>
      )}

      {/* Roles Table */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : filteredRoles.length > 0 ? (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Role / Position</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Department</th>
                <th className="px-4 py-3 font-medium">Base Permission</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Assigned</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canManageRoles && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRoles.map((role) => (
                <tr
                  key={role._id}
                  className="border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-background"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-btn bg-primary/10 p-1.5 text-primary">
                        <Briefcase size={16} />
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{role.name}</span>
                        {role.description && (
                          <p className="text-xs text-muted max-w-md line-clamp-1 mt-0.5">
                            {role.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="hidden px-4 py-3 text-muted md:table-cell">
                    {role.department?.name ? (
                      <span className="inline-flex items-center rounded-btn bg-border/40 px-2 py-0.5 text-xs font-medium">
                        {role.department.name}
                      </span>
                    ) : (
                      <span className="text-xs italic text-muted">Org-wide</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <Badge
                      value={BASE_ROLE_LABELS[role.baseRole] || role.baseRole}
                      tone={BASE_ROLE_TONES[role.baseRole] || "muted"}
                    />
                  </td>

                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <Users size={13} />
                      {role.userCount} {role.userCount === 1 ? "user" : "users"}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <Badge
                      value={role.isActive ? "active" : "inactive"}
                      tone={role.isActive ? "success" : "danger"}
                    />
                  </td>

                  {canManageRoles && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingRole(role);
                            setDialogOpen(true);
                          }}
                          aria-label={`Edit ${role.name}`}
                          className="rounded-btn p-1.5 text-muted transition-colors duration-150 hover:bg-border/50 hover:text-primary"
                          title="Edit Role"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(role)}
                          aria-label={`Delete ${role.name}`}
                          className="rounded-btn p-1.5 text-muted transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                          title="Delete Role"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Shield}
          heading={search || deptFilter || statusFilter ? "No roles match your filters" : "No roles created yet"}
          description={
            canManageRoles
              ? "Create roles to standardize job titles, permission levels, and performance criteria across your organization."
              : "No roles have been configured yet."
          }
          action={
            canManageRoles && !search && !deptFilter && !statusFilter ? (
              <Button
                onClick={() => {
                  setEditingRole(null);
                  setDialogOpen(true);
                }}
              >
                <Plus size={16} /> Create Role
              </Button>
            ) : undefined
          }
        />
      )}

      {canManageRoles && (
        <RoleDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          role={editingRole}
          departments={departments}
        />
      )}
    </div>
  );
}
