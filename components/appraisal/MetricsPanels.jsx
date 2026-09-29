import Badge from "@/components/ui/Badge";
import { fmtDateTime, fmtPct } from "@/lib/appraisal";

const STATE_TONES = { completed_on_time: "success", completed_late: "warning", overdue: "danger", pending: "muted" };

function Panel({ title, empty, children, count }) {
  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <h3 className="text-sm font-semibold">
        {title} <span className="font-normal text-muted">({count})</span>
      </h3>
      {count === 0 ? <p className="mt-2 text-sm text-muted">{empty}</p> : <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">{children}</ul>}
    </section>
  );
}

// Source records behind the automatic scores, as captured for this
// appraisal — "why did this employee get 62.4?" answered row by row.
export default function MetricsPanels({ metrics }) {
  if (!metrics) return null;
  const tasks = metrics.tasks?.list || [];
  const projects = metrics.projects?.list || [];
  const bugs = metrics.bugs?.list || [];
  const changes = metrics.clientChanges?.list || [];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel title="Tasks" count={tasks.length} empty="No tasks due or completed this month.">
        {tasks.map((t) => (
          <li key={t._id} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">
              {t.title} <span className="text-xs text-muted">· {t.project}</span>
            </span>
            <Badge value={t.state.replace(/_/g, " ")} tone={STATE_TONES[t.state]} />
          </li>
        ))}
      </Panel>
      <Panel title="Projects" count={projects.length} empty="No project work this month.">
        {projects.map((p) => (
          <li key={p.projectId} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">
              {p.name} <span className="text-xs text-muted">· weightage {p.weightage}{p.delayed ? " · delayed" : ""}</span>
            </span>
            <span className="text-xs tabular-nums text-muted">
              {p.completed}/{p.total} · {fmtPct(p.completionRate * 100)}
            </span>
          </li>
        ))}
      </Panel>
      <Panel title="Bugs" count={bugs.length} empty="No bugs reported this month.">
        {bugs.map((b) => (
          <li key={b._id} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">
              {b.title} <span className="text-xs text-muted">· {b.date}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <Badge value={b.severityLabel} tone={b.counted ? "danger" : "muted"} />
              <span className="text-xs tabular-nums text-muted">{b.counted ? `−${b.penalty}` : b.status}</span>
            </span>
          </li>
        ))}
      </Panel>
      <Panel title="Client changes" count={changes.length} empty="No client changes this month.">
        {changes.map((c) => (
          <li key={c._id} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">
              {c.title} <span className="text-xs text-muted">· {fmtDateTime(c.createdAt)}</span>
            </span>
            <Badge value={c.categoryLabel} tone={c.counted ? "warning" : "muted"} />
          </li>
        ))}
      </Panel>
    </div>
  );
}
