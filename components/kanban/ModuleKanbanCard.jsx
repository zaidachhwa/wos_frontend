import { CalendarDays } from "lucide-react";

import ProgressBar from "@/components/shared/ProgressBar";

export default function ModuleKanbanCard({ module, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="w-full cursor-grab rounded-card border border-border bg-surface p-4 text-left transition-all duration-150 hover:border-muted/40 hover:shadow-sm active:cursor-grabbing"
    >
      <p className="truncate text-sm font-medium leading-snug">{module.name}</p>
      <div className="mt-3">
        <ProgressBar value={module.progress} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1">
          <CalendarDays size={12} />
          {module.deadline ? new Date(module.deadline).toLocaleDateString() : "—"}
        </span>
        <span className="tabular-nums">{module.taskCount ?? 0} tasks</span>
      </div>
      {module.assignees?.length > 0 && (
        <p className="mt-1 truncate text-xs text-muted">{module.assignees.map((a) => a.name).join(", ")}</p>
      )}
    </button>
  );
}
