import Link from "next/link";
import { CalendarDays } from "lucide-react";

import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/shared/ProgressBar";

export default function ProjectCard({ project }) {
  return (
    <Link
      href={`/projects/${project._id}`}
      className="block rounded-card border border-border bg-surface p-6 transition-all duration-150 hover:border-muted/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-base font-semibold tracking-tight">{project.name}</p>
        <Badge value={project.status} />
      </div>
      <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted">{project.description || "No description."}</p>
      <div className="mt-4">
        <ProgressBar value={project.progress} />
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <Badge value={project.priority} />
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarDays size={14} />
          {project.deadline ? new Date(project.deadline).toLocaleDateString() : "No deadline"}
        </span>
      </div>
      <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted">
        Managed by <span className="font-medium text-primary">{project.manager?.name || "—"}</span>
      </p>
    </Link>
  );
}
