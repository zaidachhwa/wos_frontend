"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Trophy, Medal, Award, Download, Lock } from "lucide-react";

import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Button, Select } from "@/components/ui/Field";
import { fetchLeaderboard, downloadLeaderboardCsv } from "@/services/leaderboardService";
import { fetchTeams } from "@/services/orgService";
import { useAuthStore } from "@/store/authStore";

const pad = (n) => String(n).padStart(2, "0");
const dayStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtShort = (d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtLong = (d) => new Date(d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

const PODIUM_ICONS = [Trophy, Medal, Award];
const PODIUM_TONES = ["text-warning", "text-muted", "text-warning/70"];

export default function LeaderboardPage() {
  const me = useAuthStore((s) => s.user);
  const isReporter = ["admin", "manager", "subadmin"].includes(me?.role);
  const [anchor, setAnchor] = useState(() => dayStr(new Date()));
  const [team, setTeam] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", anchor, team],
    queryFn: () => fetchLeaderboard({ week: anchor, team }),
  });

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });

  const shiftWeek = (days) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + days);
    setAnchor(dayStr(d));
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-card" />;
  }

  // Rankings are revealed once a week (Monday) — see leaderboardController.getLeaderboard.
  if (data?.locked) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <EmptyState
          icon={Lock}
          heading="Leaderboard opens Monday"
          description={`Rankings are revealed once a week. Check back ${fmtLong(data.nextMonday)}.`}
        />
      </div>
    );
  }

  const rows = data?.rows || [];
  const podium = rows.filter((r) => r.rank <= 3 && r.points > 0);
  const rest = rows.filter((r) => !(r.rank <= 3 && r.points > 0));
  const hasPoints = rows.some((r) => r.points > 0);

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => shiftWeek(-7)}>
            <ChevronLeft size={15} />
          </Button>
          <p className="min-w-40 text-center text-sm font-medium tabular-nums">
            {data ? `${fmtShort(data.weekStart)} – ${fmtShort(data.weekEnd)}` : "This week"}
          </p>
          <Button variant="secondary" onClick={() => shiftWeek(7)}>
            <ChevronRight size={15} />
          </Button>
          <Button variant="secondary" onClick={() => setAnchor(dayStr(new Date()))}>
            This week
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Select aria-label="Filter by team" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </Select>
          {isReporter && (
            <Button variant="secondary" onClick={() => downloadLeaderboardCsv({ week: anchor, team })}>
              <Download size={15} /> Export CSV
            </Button>
          )}
        </div>
      </div>

      {!hasPoints ? (
        <EmptyState
          icon={Trophy}
          heading="No completed tasks this week yet"
          description="Points appear here once tasks get marked completed."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {podium.map((row) => {
              const Icon = PODIUM_ICONS[row.rank - 1] || Award;
              return (
                <div
                  key={row.user._id}
                  className="flex flex-col items-center gap-2 rounded-card border border-border bg-surface p-6 text-center"
                >
                  <Icon size={28} className={PODIUM_TONES[row.rank - 1] || "text-muted"} />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">#{row.rank}</p>
                  <p className="text-base font-semibold">{row.user.name}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge value={row.user.role} />
                    {row.user.team && <Badge value={row.user.team.name} />}
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{row.points}</p>
                  <p className="text-xs text-muted">
                    {row.tasksCompleted} task{row.tasksCompleted === 1 ? "" : "s"} completed
                  </p>
                </div>
              );
            })}
          </div>

          {rest.length > 0 && (
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 font-medium">Rank</th>
                    <th className="px-4 py-3 font-medium">Person</th>
                    <th className="px-4 py-3 font-medium">Team</th>
                    <th className="px-4 py-3 text-right font-medium">Tasks done</th>
                    <th className="px-4 py-3 text-right font-medium">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((row) => (
                    <tr key={row.user._id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 tabular-nums text-muted">#{row.rank}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.user.name}</p>
                        <p className="text-xs text-muted">{row.user.designation || row.user.role}</p>
                      </td>
                      <td className="px-4 py-3 text-muted">{row.user.team?.name || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.tasksCompleted}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
