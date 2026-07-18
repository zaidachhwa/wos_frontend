import Link from "next/link";
import { CalendarDays } from "lucide-react";

import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/shared/ProgressBar";

export default function ProjectKanbanCard({ project }) {
  return (
    <Link
      href={`/projects/${project._id}`}
      className="block w-full cursor-grab rounded-card border border-border bg-surface p-4 text-left transition-all duration-150 hover:border-muted/40 hover:shadow-sm active:cursor-grabbing"
    >
      <p className="truncate text-sm font-medium leading-snug">{project.name}</p>
      <div className="mt-3 flex items-center gap-2">
        <Badge value={project.priority} />
      </div>
      {project.progress != null && (
        <div className="mt-3">
          <ProgressBar value={project.progress} />
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1">
          <CalendarDays size={12} />
          {project.deadline ? new Date(project.deadline).toLocaleDateString() : "—"}
        </span>
        {project.manager?.name && <span className="truncate">{project.manager.name}</span>}
      </div>
    </Link>
  );
}
