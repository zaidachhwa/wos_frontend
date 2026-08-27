"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

import Badge from "@/components/ui/Badge";

const ROLE_TONES = { admin: "danger", manager: "info", subadmin: "success", sublead: "warning", member: "muted", hr: "info", qa: "warning" };

export default function UserTable({ users, canEdit, onEdit, onDelete }) {
  const showActions = users.some((u) => canEdit(u));
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Designation</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Department</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Team</th>
            {showActions && <th className="hidden px-4 py-3 font-medium sm:table-cell">Status</th>}
            {showActions && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id} className="border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-background">
              <td className="px-4 py-3">
                <Link href={`/team/${u._id}`} className="font-medium hover:text-primary hover:underline">
                  {u.name}
                </Link>
                {u.email && <p className="text-xs text-muted">{u.email}</p>}
              </td>
              <td className="px-4 py-3">
                <Badge value={u.role} tone={ROLE_TONES[u.role]} />
              </td>
              <td className="hidden px-4 py-3 text-muted sm:table-cell">{u.designation || "—"}</td>
              <td className="hidden px-4 py-3 text-muted md:table-cell">{u.department?.name || "—"}</td>
              <td className="hidden px-4 py-3 text-muted md:table-cell">{u.team?.name || "—"}</td>
              {showActions && (
                <td className="hidden px-4 py-3 sm:table-cell">
                  <Badge value={u.isActive ? "active" : "inactive"} tone={u.isActive ? "success" : "danger"} />
                </td>
              )}
              {showActions && (
                <td className="px-4 py-3 text-right">
                  {canEdit(u) && (
                    <button
                      onClick={() => onEdit(u)}
                      aria-label={`Edit ${u.name}`}
                      className="rounded-btn p-1.5 text-muted transition-colors duration-150 hover:bg-border/50 hover:text-primary"
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  {canEdit(u) && u.isActive && (
                    <button
                      onClick={() => onDelete(u)}
                      aria-label={`Delete ${u.name}`}
                      className="rounded-btn p-1.5 text-muted transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
