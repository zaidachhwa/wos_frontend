"use client";

import Badge from "@/components/ui/Badge";
import { isTaskOverdue } from "@/lib/taskDates";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

export default function TaskTable({ tasks, onOpen, selected, onToggleSelect, onToggleSelectAll }) {
  const selectable = Boolean(selected);
  const allSelected = selectable && tasks.length > 0 && tasks.every((t) => selected.has(t._id));

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            {selectable && (
              <th className="px-4 py-3 font-medium">
                <input
                  type="checkbox"
                  aria-label="Select all visible tasks"
                  checked={allSelected}
                  onChange={(e) => onToggleSelectAll(tasks, e.target.checked)}
                  className="accent-primary"
                />
              </th>
            )}
            <th className="px-4 py-3 font-medium">Task</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Project</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Priority</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Assignees</th>
            <th className="px-4 py-3 font-medium">Deadline</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Est. hrs</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr
              key={t._id}
              onClick={() => onOpen(t)}
              className="cursor-pointer border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-background"
            >
              {selectable && (
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select task ${t.title}`}
                    checked={selected.has(t._id)}
                    onChange={() => onToggleSelect(t._id)}
                    className="accent-primary"
                  />
                </td>
              )}
              <td className="max-w-[140px] px-4 py-3 sm:max-w-xs">
                <p className="flex items-center gap-1.5">
                  {t.type === "bug" && <Badge value="bug" />}
                  <span className="truncate font-medium">{t.title}</span>
                  {["pending", "rejected"].includes(t.approvalStatus) && <Badge value={t.approvalStatus} />}
                </p>
                {t.labels?.length > 0 && (
                  <p className="mt-0.5 truncate text-xs text-muted">{t.labels.join(" · ")}</p>
                )}
              </td>
              <td className="hidden truncate px-4 py-3 text-muted sm:table-cell">{t.project?.name || "—"}</td>
              <td className="px-4 py-3">
                <Badge value={t.status} />
              </td>
              <td className="hidden px-4 py-3 sm:table-cell">
                <Badge value={t.priority} />
              </td>
              <td className="hidden px-4 py-3 text-muted sm:table-cell">
                {t.assignees?.length ? t.assignees.map((a) => a.name).join(", ") : "Unassigned"}
              </td>
              <td className="px-4 py-3 tabular-nums text-muted">
                <span className="inline-flex items-center gap-1.5">
                  {fmtDate(t.deadline)}
                  {isTaskOverdue(t) && <Badge value="overdue" tone="danger" />}
                </span>
              </td>
              <td className="hidden px-4 py-3 tabular-nums text-muted md:table-cell">{t.estimatedHours ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
