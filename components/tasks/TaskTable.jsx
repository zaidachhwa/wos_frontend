"use client";

import Badge from "@/components/ui/Badge";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const isOverdue = (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "completed";

export default function TaskTable({ tasks, onOpen }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Task</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Priority</th>
            <th className="px-4 py-3 font-medium">Assignee</th>
            <th className="px-4 py-3 font-medium">Deadline</th>
            <th className="px-4 py-3 font-medium">Est. hrs</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr
              key={t._id}
              onClick={() => onOpen(t)}
              className="cursor-pointer border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-background"
            >
              <td className="max-w-xs px-4 py-3">
                <p className="truncate font-medium">{t.title}</p>
                {t.labels?.length > 0 && (
                  <p className="mt-0.5 truncate text-xs text-muted">{t.labels.join(" · ")}</p>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge value={t.status} />
              </td>
              <td className="px-4 py-3">
                <Badge value={t.priority} />
              </td>
              <td className="px-4 py-3 text-muted">{t.assignee?.name || "Unassigned"}</td>
              <td className="px-4 py-3 tabular-nums text-muted">
                <span className="inline-flex items-center gap-1.5">
                  {fmtDate(t.deadline)}
                  {isOverdue(t) && <Badge value="overdue" tone="danger" />}
                </span>
              </td>
              <td className="px-4 py-3 tabular-nums text-muted">{t.estimatedHours ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
