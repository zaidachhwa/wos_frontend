"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ShieldAlert } from "lucide-react";

import StatTile from "@/components/appraisal/StatTile";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { fetchAvailability } from "@/services/peopleService";

const fmt = (d) =>
  new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function StatusCell({ p }) {
  if (p.status === "engaged") {
    const days = p.daysUntilFree;
    return (
      <div>
        <Badge
          value={days <= 0 ? "Free later today" : `Free in ${days} day${days === 1 ? "" : "s"}`}
          tone={days <= 3 ? "warning" : "info"}
        />
        <p className="mt-1 text-xs text-muted">Engaged until {fmt(p.engagedUntil)}</p>
      </div>
    );
  }
  if (p.status === "overdue")
    return <Badge value={`${p.overdueTasks} overdue task${p.overdueTasks === 1 ? "" : "s"}`} tone="danger" />;
  return <Badge value="Free now" tone="success" />;
}

// Team Lead / Project Manager / Technical Coordinator panel: who is engaged
// until when, and when each person gets free (from open task deadlines).
export default function AvailabilityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["availability"],
    queryFn: fetchAvailability,
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="mx-auto h-96 max-w-[1200px] rounded-card" />;
  if (!data?.hasAccess) {
    return (
      <EmptyState
        icon={ShieldAlert}
        heading="Nothing to show"
        description="This panel lists the people you lead: your team (Team Lead), your projects' members (Project Manager) or your department (Technical Coordinator)."
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Team availability</h1>
        <p className="mt-1 text-sm text-muted">
          Each person is engaged until the latest deadline of their open, approved tasks, and free after that. Technical
          Coordinators get an email 7, 5, 3, 2 and 1 day before someone in their department gets free, and when they are
          free.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="People" value={data.summary.total} />
        <StatTile label="Free now" value={data.summary.free} tone="success" />
        <StatTile label="Free within 7 days" value={data.summary.freeWithin7Days} tone="warning" />
        <StatTile label="Engaged" value={data.summary.engaged} tone="info" />
        <StatTile label="Overdue work" value={data.summary.overdue} tone="danger" />
      </div>

      {data.groups.map((g) => (
        <section key={g.label} className="space-y-2">
          <h2 className="text-base font-semibold tracking-tight">
            {g.label} <span className="font-normal text-muted">({g.people.length})</span>
          </h2>
          {g.people.length === 0 ? (
            <EmptyState icon={CalendarClock} heading="No one here yet" />
          ) : (
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="px-4 py-3 font-medium">Availability</th>
                    <th className="px-4 py-3 font-medium">Working on</th>
                    <th className="px-4 py-3 text-right font-medium">Open tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {g.people.map((p) => (
                    <tr key={p.user._id} className="border-b border-border/60 align-top last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.user.name}</p>
                        <p className="text-xs text-muted">{p.user.designation || p.user.role}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusCell p={p} />
                      </td>
                      <td className="max-w-md px-4 py-3">
                        {p.tasks.length ? (
                          <ul className="space-y-1 text-xs">
                            {p.tasks.slice(-3).map((t) => (
                              <li
                                key={t._id}
                                className="flex flex-wrap items-center gap-1.5"
                                title={`${t.title} — due ${fmt(t.dueAt)}`}
                              >
                                <Badge value={t.priority || "low"} />
                                <span className="font-medium text-foreground">{t.title}</span>
                                {t.project && (
                                  <span className="text-muted inline-flex items-center gap-1">
                                    <span>· {t.project}</span>
                                    {t.projectPriority && <Badge value={t.projectPriority} />}
                                  </span>
                                )}
                                <span className="text-muted">· due {fmt(t.dueAt)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : p.projects?.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {p.projects.map((proj) => {
                              const name = typeof proj === "string" ? proj : proj.name;
                              const priority = typeof proj === "object" ? proj.priority : null;
                              return (
                                <span
                                  key={proj._id || name}
                                  className="inline-flex items-center gap-1 text-xs text-muted"
                                >
                                  <span>{name}</span>
                                  {priority && <Badge value={priority} />}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {p.openTasks}
                        {p.undatedTasks > 0 && (
                          <span className="block text-xs text-muted">{p.undatedTasks} without deadline</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
