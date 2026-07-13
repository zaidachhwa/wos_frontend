"use client";

import { GanttChartSquare } from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";

const STATUS_BG = {
  completed: "bg-success",
  blocked: "bg-danger",
  in_progress: "bg-info",
  review: "bg-warning",
  testing: "bg-warning",
  active: "bg-info",
  on_hold: "bg-warning",
  cancelled: "bg-danger",
};

const fmt = (d) =>
  new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function TimelineView({ project, tasks }) {
  const dated = [
    ...(project.modules || []).map((m) => ({
      kind: "module",
      name: m.name,
      status: m.status,
      start: new Date(m.createdAt || project.createdAt),
      end: m.deadline ? new Date(m.deadline) : null,
    })),
    ...tasks.map((t) => ({
      kind: "task",
      name: t.title,
      status: t.status,
      start: new Date(t.createdAt),
      end: t.deadline ? new Date(t.deadline) : null,
    })),
  ].filter((r) => r.end);

  if (!dated.length) {
    return (
      <EmptyState
        icon={GanttChartSquare}
        heading="Nothing to plot yet"
        description="Give modules and tasks deadlines to see them on the timeline."
      />
    );
  }

  const now = new Date();
  const min = new Date(Math.min(...dated.map((r) => r.start), project.startDate ? new Date(project.startDate) : now));
  const max = new Date(Math.max(...dated.map((r) => r.end), project.deadline ? new Date(project.deadline) : now, now));
  const span = Math.max(1, max - min);
  const pct = (d) => Math.min(100, Math.max(0, ((d - min) / span) * 100));

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => new Date(min.getTime() + span * f));
  const todayPct = pct(now);

  const Row = ({ row }) => {
    const left = pct(row.start);
    const width = Math.max(1.5, pct(row.end) - left);
    return (
      <div className="grid grid-cols-[minmax(8rem,14rem)_1fr] items-center gap-3 py-1.5">
        <p className={`truncate text-sm ${row.kind === "module" ? "font-semibold" : "text-muted"}`}>
          {row.name}
        </p>
        <div className="relative h-5">
          <div
            title={`${row.name}: ${fmt(row.start)} → ${fmt(row.end)} (${row.status.replace("_", " ")})`}
            className={`absolute top-1 h-3 rounded-full ${STATUS_BG[row.status] || "bg-border"} ${
              row.kind === "module" ? "opacity-90" : "opacity-70"
            }`}
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-card border border-border bg-surface p-6">
      <div className="grid grid-cols-[minmax(8rem,14rem)_1fr] gap-3 border-b border-border pb-2">
        <span />
        <div className="relative flex justify-between text-xs tabular-nums text-muted">
          {ticks.map((t, i) => (
            <span key={i}>{fmt(t)}</span>
          ))}
        </div>
      </div>

      <div className="relative mt-2">
        {/* today marker */}
        <div className="pointer-events-none absolute inset-y-0 z-10 grid grid-cols-[minmax(8rem,14rem)_1fr] gap-3">
          <span />
          <div className="relative">
            <div
              title="Today"
              className="absolute inset-y-0 w-px bg-danger/60"
              style={{ left: `${todayPct}%` }}
            />
          </div>
        </div>

        {dated.filter((r) => r.kind === "module").map((row, i) => (
          <Row key={`m${i}`} row={row} />
        ))}
        {dated.filter((r) => r.kind === "task").map((row, i) => (
          <Row key={`t${i}`} row={row} />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-3 text-xs text-muted">
        {[
          ["bg-info", "in progress / active"],
          ["bg-warning", "review / on hold"],
          ["bg-success", "completed"],
          ["bg-danger", "blocked"],
          ["bg-border", "planned"],
        ].map(([cls, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`h-2 w-4 rounded-full ${cls}`} /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}
