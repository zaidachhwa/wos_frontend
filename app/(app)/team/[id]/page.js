"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Trophy, Lock, ListChecks } from "lucide-react";

import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Field";
import TaskTable from "@/components/tasks/TaskTable";
import { fetchUserById } from "@/services/orgService";
import { fetchTasks } from "@/services/taskService";
import { fetchLeaderboard } from "@/services/leaderboardService";

const TABS = ["overview", "tasks", "leaderboard"];
const ROLE_TONES = { admin: "danger", manager: "info", subadmin: "success", sublead: "warning", member: "muted" };

const pad = (n) => String(n).padStart(2, "0");
const dayStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtShort = (d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtLong = (d) => new Date(d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

// Monday–Sunday bounds for a given anchor date — mirrors weekBoundsOf in
// leaderboardController.js so the task filter's week matches the
// leaderboard's week for the same anchor.
const weekBoundsOf = (anchorStr) => {
  const d = new Date(anchorStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: dayStr(start), end: dayStr(end) };
};

export default function TeamMemberProfilePage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const [anchor, setAnchor] = useState(() => dayStr(new Date()));

  const { data: user, isLoading } = useQuery({
    queryKey: ["user", id],
    queryFn: () => fetchUserById(id),
  });

  const { start: weekStart, end: weekEnd } = weekBoundsOf(anchor);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks", { assignee: id, dueAfter: weekStart, dueBefore: weekEnd }],
    queryFn: () => fetchTasks({ assignee: id, dueAfter: weekStart, dueBefore: weekEnd }),
    enabled: tab === "tasks",
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ["leaderboard", anchor],
    queryFn: () => fetchLeaderboard({ week: anchor }),
    enabled: tab === "leaderboard",
  });

  const shiftWeek = (days) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + days);
    setAnchor(dayStr(d));
  };

  if (isLoading || !user) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-4">
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const myRow = leaderboard?.rows?.find((r) => r.user._id === id);

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header className="rounded-card border border-border bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-background text-lg font-semibold uppercase text-muted">
              {user.name?.slice(0, 2)}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">{user.name}</h2>
                <Badge value={user.role} tone={ROLE_TONES[user.role]} />
                <Badge value={user.isActive ? "active" : "inactive"} tone={user.isActive ? "success" : "danger"} />
              </div>
              <p className="mt-1 text-sm text-muted">
                {user.designation || "—"} · {user.department?.name || "No department"}
                {user.team?.name ? ` · ${user.team.name}` : ""}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto rounded-btn border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-[8px] px-3 py-1.5 text-sm font-medium capitalize transition-colors duration-150 ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted hover:text-primary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 rounded-card border border-border bg-surface p-6 sm:grid-cols-2">
          {[
            ["Email", user.email],
            ["Role", <Badge key="role" value={user.role} tone={ROLE_TONES[user.role]} />],
            ["Designation", user.designation || "—"],
            ["Department", user.department?.name || "—"],
            ["Team", user.team?.name || "—"],
            ["Reporting manager", user.reportingManager?.name || "—"],
            [
              "Shift timing",
              user.shiftStart && user.shiftEnd
                ? `${user.shiftStart} – ${user.shiftEnd}`
                : user.shiftStart
                  ? `From ${user.shiftStart}`
                  : "Not set",
            ],
            ["Morning follow-up deadline", user.morningDeadline ? `${user.morningDeadline} (Custom)` : "Org default"],
            ["Status", user.isActive ? "Active" : "Inactive"],
            [
              "Joined on",
              user.joinedAt
                ? new Date(user.joinedAt).toLocaleDateString()
                : new Date(user.createdAt).toLocaleDateString(),
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
              <p className="mt-1 text-sm">{value}</p>
            </div>
          ))}
        </div>
      )}

      {(tab === "tasks" || tab === "leaderboard") && (
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => shiftWeek(-7)}>
            <ChevronLeft size={15} />
          </Button>
          <p className="min-w-40 text-center text-sm font-medium tabular-nums">
            {fmtShort(weekStart)} – {fmtShort(weekEnd)}
          </p>
          <Button variant="secondary" onClick={() => shiftWeek(7)}>
            <ChevronRight size={15} />
          </Button>
          <Button variant="secondary" onClick={() => setAnchor(dayStr(new Date()))}>
            This week
          </Button>
        </div>
      )}

      {tab === "tasks" &&
        (tasksLoading ? (
          <Skeleton className="h-48 w-full rounded-card" />
        ) : tasks.length ? (
          <TaskTable tasks={tasks} onOpen={(t) => router.push(`/tasks?open=${t._id}`)} />
        ) : (
          <EmptyState icon={ListChecks} heading="No tasks due this week" />
        ))}

      {tab === "leaderboard" &&
        (leaderboardLoading ? (
          <Skeleton className="h-32 w-full rounded-card" />
        ) : leaderboard?.locked ? (
          <EmptyState
            icon={Lock}
            heading="Leaderboard opens Monday"
            description={`Rankings are revealed once a week. Check back ${fmtLong(leaderboard.nextMonday)}.`}
          />
        ) : (
          <div className="rounded-card border border-border bg-surface p-6 text-center">
            <Trophy size={28} className="mx-auto text-warning" />
            {myRow ? (
              <>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Rank #{myRow.rank}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums">{myRow.points}</p>
                <p className="mt-1 text-sm text-muted">
                  {myRow.tasksCompleted} task{myRow.tasksCompleted === 1 ? "" : "s"} completed this week
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">No completed tasks this week yet.</p>
            )}
          </div>
        ))}
    </div>
  );
}
