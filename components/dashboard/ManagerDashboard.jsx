import WidgetCard from "@/components/dashboard/WidgetCard";
import DailyPlanCard from "@/components/dashboard/DailyPlanCard";
import WorkloadCard from "@/components/dashboard/WorkloadCard";
import TaskMiniList from "@/components/dashboard/TaskMiniList";
import ScheduleList from "@/components/dashboard/ScheduleList";
import ActivityFeed from "@/components/shared/ActivityFeed";
import Badge from "@/components/ui/Badge";

const PendingList = ({ people }) =>
  people?.length ? (
    <ul className="space-y-1">
      {people.map(({ user }) => (
        <li key={user._id} className="flex items-center justify-between rounded-btn px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-background">
          <span>{user.name}</span>
          <Badge value="missing" />
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-success">Everyone has submitted.</p>
  );

export default function ManagerDashboard({ data }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <WidgetCard title="Today's schedule" href="/calendar">
        <ScheduleList blocks={data.todaySchedule} />
      </WidgetCard>

      <WidgetCard title="Morning follow-ups pending" href="/follow-ups">
        <PendingList people={data.pendingFollowUps?.morning} />
      </WidgetCard>

      <WidgetCard title="Evening follow-ups pending" href="/follow-ups">
        <PendingList people={data.pendingFollowUps?.evening} />
      </WidgetCard>

      <WidgetCard title="Overdue tasks" href="/tasks">
        <TaskMiniList tasks={data.overdueTasks} empty="Nothing overdue." showAssignee />
      </WidgetCard>

      <WidgetCard title="Upcoming deadlines (7d)" href="/tasks">
        <TaskMiniList tasks={data.upcomingDeadlines} empty="No deadlines this week." showAssignee />
      </WidgetCard>

      <WidgetCard title="Blocked" href="/kanban">
        <TaskMiniList tasks={data.blockedTasks} empty="Nobody is blocked." showAssignee />
      </WidgetCard>

      <WidgetCard title="Delayed projects" href="/projects">
        {data.delayedProjects?.length ? (
          <ul className="space-y-1">
            {data.delayedProjects.map((p) => (
              <li key={p._id} className="flex items-center justify-between rounded-btn px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-background">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-danger">
                  due {new Date(p.deadline).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No delayed projects.</p>
        )}
      </WidgetCard>

      <WorkloadCard workload={data.workload} />

      <DailyPlanCard />

      <WidgetCard title="Recent activity" className="lg:col-span-3">
        <ActivityFeed activities={data.recentActivity} />
      </WidgetCard>
    </div>
  );
}
