import WidgetCard from "@/components/dashboard/WidgetCard";
import DailyPlanCard from "@/components/dashboard/DailyPlanCard";
import ActivityFeed from "@/components/shared/ActivityFeed";
import Badge from "@/components/ui/Badge";

export default function AdminDashboard({ data }) {
  const { totals, teams, recentActivity } = data;
  const statusEntries = Object.entries(totals.projectsByStatus || {});
  const totalProjects = statusEntries.reduce((s, [, n]) => s + n, 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="grid grid-cols-3 gap-4 lg:col-span-3">
        {[
          ["Projects", totalProjects],
          ["Active users", totals.activeUsers],
          ["Managers", totals.managers],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-border bg-surface p-6">
            <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value ?? 0}</p>
          </div>
        ))}
      </div>

      <WidgetCard title="Projects by status" href="/projects">
        {statusEntries.length ? (
          <ul className="space-y-2">
            {statusEntries.map(([status, count]) => (
              <li key={status} className="flex items-center justify-between text-sm">
                <Badge value={status} />
                <span className="tabular-nums text-muted">{count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No projects yet.</p>
        )}
      </WidgetCard>

      <WidgetCard title="Teams" href="/team">
        {teams?.length ? (
          <ul className="space-y-2">
            {teams.map((t) => (
              <li key={t.name} className="flex items-center justify-between text-sm">
                <span className="font-medium">{t.name}</span>
                <span className="tabular-nums text-muted">{t.memberCount} members</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No teams yet.</p>
        )}
      </WidgetCard>

      <DailyPlanCard />

      <WidgetCard title="Recent activity" className="lg:col-span-3">
        <ActivityFeed activities={recentActivity} />
      </WidgetCard>
    </div>
  );
}
