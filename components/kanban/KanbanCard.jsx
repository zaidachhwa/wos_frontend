import { CalendarDays, Clock, Lock } from "lucide-react";

import Badge from "@/components/ui/Badge";

export default function KanbanCard({ task, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="w-full cursor-grab rounded-card border border-border bg-surface p-4 text-left transition-all duration-150 hover:border-muted/40 hover:shadow-sm active:cursor-grabbing"
    >
      <p className="flex items-start justify-between gap-2 text-sm font-medium leading-snug">
        <span className="flex items-center gap-1.5">
          {task.type === "bug" && <Badge value="bug" />}
          {task.title}
        </span>
        {["pending", "rejected"].includes(task.approvalStatus) && (
          <span className="shrink-0">
            <Badge value={task.approvalStatus} />
          </span>
        )}
      </p>
      {task.labels?.length > 0 && (
        <p className="mt-1 truncate text-xs text-muted">{task.labels.join(" · ")}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Badge value={task.priority} />
        {task.estimatedHours != null && (
          <span className="flex items-center gap-1 text-xs tabular-nums text-muted">
            <Clock size={12} />
            {task.estimatedHours}h
          </span>
        )}
        {task.blockedBy?.length > 0 && (
          <span className="flex items-center gap-1 text-xs tabular-nums text-muted" title="Blocked by other tasks">
            <Lock size={12} />
            {task.blockedBy.length}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
        <span className="flex shrink-0 items-center gap-1">
          <CalendarDays size={12} />
          {task.deadline ? new Date(task.deadline).toLocaleDateString() : "—"}
        </span>
        {task.assignees?.length > 0 && (
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="flex shrink-0 -space-x-1.5">
              {task.assignees.slice(0, 3).map((a) => (
                <span
                  key={a._id}
                  title={a.name}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-surface bg-background text-[10px] font-semibold uppercase"
                >
                  {a.name.slice(0, 2)}
                </span>
              ))}
            </div>
            <span className="truncate">
              {task.assignees.length <= 2
                ? task.assignees.map((a) => a.name.split(" ")[0]).join(", ")
                : `${task.assignees[0].name.split(" ")[0]} +${task.assignees.length - 1}`}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
