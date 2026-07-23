"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Trophy, Medal, Award } from "lucide-react";

import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Field";
import { fetchLeaderboard } from "@/services/leaderboardService";

const pad = (n) => String(n).padStart(2, "0");
const dayStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtShort = (d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const PODIUM_ICONS = [Trophy, Medal, Award];
const PODIUM_TONES = ["text-warning", "text-muted", "text-warning/70"];

export default function LeaderboardPage() {
  const [anchor, setAnchor] = useState(() => dayStr(new Date()));

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", anchor],
    queryFn: () => fetchLeaderboard({ week: anchor }),
  });

  const shiftWeek = (days) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + days);
    setAnchor(dayStr(d));
  };

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
        </div>
        <Button variant="secondary" onClick={() => setAnchor(dayStr(new Date()))}>
          This week
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-card" />
      ) : !hasPoints ? (
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
                  <Badge value={row.user.role} />
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
