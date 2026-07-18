import { CalendarDays, Clock, Lock } from "lucide-react";

import Badge from "@/components/ui/Badge";

export default function KanbanCard({ task, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="w-full cursor-grab rounded-card border border-border bg-surface p-4 text-left transition-all duration-150 hover:border-muted/40 hover:shadow-sm active:cursor-grabbing"
    >
      <p className="text-sm font-medium leading-snug">{task.title}</p>
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
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1">
          <CalendarDays size={12} />
          {task.deadline ? new Date(task.deadline).toLocaleDateString() : "—"}
        </span>
        {task.assignees?.length > 0 && (
          <div className="flex -space-x-1.5">
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
        )}
      </div>
    </button>
  );
}
