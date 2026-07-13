"use client";

import { Pencil } from "lucide-react";

import Badge from "@/components/ui/Badge";

const ROLE_TONES = { admin: "danger", manager: "info", sublead: "warning", member: "muted" };

export default function UserTable({ users, canEdit, onEdit }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Designation</th>
            <th className="px-4 py-3 font-medium">Department</th>
            <th className="px-4 py-3 font-medium">Team</th>
            {canEdit && <th className="px-4 py-3 font-medium">Status</th>}
            {canEdit && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id} className="border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-background">
              <td className="px-4 py-3">
                <p className="font-medium">{u.name}</p>
                {u.email && <p className="text-xs text-muted">{u.email}</p>}
              </td>
              <td className="px-4 py-3">
                <Badge value={u.role} tone={ROLE_TONES[u.role]} />
              </td>
              <td className="px-4 py-3 text-muted">{u.designation || "—"}</td>
              <td className="px-4 py-3 text-muted">{u.department?.name || "—"}</td>
              <td className="px-4 py-3 text-muted">{u.team?.name || "—"}</td>
              {canEdit && (
                <td className="px-4 py-3">
                  <Badge value={u.isActive ? "active" : "inactive"} tone={u.isActive ? "success" : "danger"} />
                </td>
              )}
              {canEdit && (
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onEdit(u)}
                    aria-label={`Edit ${u.name}`}
                    className="rounded-btn p-1.5 text-muted transition-colors duration-150 hover:bg-border/50 hover:text-primary"
                  >
                    <Pencil size={16} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
