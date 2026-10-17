import Link from "next/link";

import WidgetCard from "@/components/dashboard/WidgetCard";
import DailyPlanCard from "@/components/dashboard/DailyPlanCard";
import TaskMiniList from "@/components/dashboard/TaskMiniList";
import ScheduleList from "@/components/dashboard/ScheduleList";
import ActivityFeed from "@/components/shared/ActivityFeed";
import ProgressBar from "@/components/shared/ProgressBar";
import Badge from "@/components/ui/Badge";

export default function MemberDashboard({ data }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <WidgetCard title="Today's tasks" href="/tasks">
        <TaskMiniList tasks={data.todayTasks} empty="No tasks due today — check upcoming deadlines." />
      </WidgetCard>

      <WidgetCard title="Yesterday (carried over)" href="/tasks">
        <TaskMiniList tasks={data.yesterdayTasks} empty="Nothing carried over — you're all caught up." />
      </WidgetCard>

      <WidgetCard title="Today's schedule" href="/calendar">
        <ScheduleList blocks={data.todaySchedule} />
      </WidgetCard>

      <WidgetCard title="Follow-ups" href="/follow-ups">
        <ul className="space-y-2 text-sm">
          {["morning", "evening"].map((type) => (
            <li key={type} className="flex items-center justify-between">
              <span className="capitalize">{type}</span>
              <Badge value={data.followUpStatus?.[type] || "missing"} />
            </li>
          ))}
        </ul>
      </WidgetCard>

      <WidgetCard title="Upcoming deadlines (7d)" href="/tasks">
        <TaskMiniList tasks={data.upcomingDeadlines} empty="No deadlines this week." />
      </WidgetCard>

      <WidgetCard title="My projects" href="/projects">
        {data.projects?.length ? (
          <ul className="space-y-3">
            {data.projects.slice(0, 4).map((p) => (
              <li key={p._id}>
                <Link href={`/projects/${p._id}`} className="text-sm font-medium hover:underline">
                  {p.name}
                </Link>
                <div className="mt-1">
                  <ProgressBar value={p.progress} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">You&apos;re not on any projects yet.</p>
        )}
      </WidgetCard>

      <WidgetCard title="General Tasks (Director)" href="/general">
        {data.generalTasks?.length ? (
          <ul className="space-y-2">
            {data.generalTasks.map((t) => (
              <li key={t._id} className="flex items-center justify-between border-b border-border/40 py-1.5 text-sm last:border-b-0">
                <div className="min-w-0 pr-2">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="text-xs text-muted">
                    Due {new Date(t.dueAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {t.createdBy?.name ? ` · from ${t.createdBy.name}` : ""}
                  </p>
                </div>
                <Badge value={t.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No pending general tasks.</p>
        )}
      </WidgetCard>

      <DailyPlanCard />

      <WidgetCard title="Recent activity" className="lg:col-span-3">
        <ActivityFeed activities={data.recentActivity} emptyText="Your actions will appear here." />
      </WidgetCard>
    </div>
  );
}
