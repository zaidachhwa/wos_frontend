"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ClipboardCheck } from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Select } from "@/components/ui/Field";
import { fetchAppraisal } from "@/services/appraisalService";
import { fetchTeams } from "@/services/orgService";
import { useAuthStore } from "@/store/authStore";

const monthStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const fmtMonth = (d) => new Date(d).toLocaleDateString(undefined, { month: "long", year: "numeric" });

// Driven by the server-computed `band` field (utils/performanceBand.js) —
// the same decision the monthly memo sweep makes, never a second cutoff.
const BAND_STYLE = {
  green: { text: "text-success", label: "Green" },
  yellow: { text: "text-warning", label: "Yellow" },
  red: { text: "text-danger", label: "Red" },
};
const bandTone = (band) => BAND_STYLE[band]?.text || "text-muted";
const bandLabel = (band) => BAND_STYLE[band]?.label || "—";

export default function AppraisalPage() {
  const me = useAuthStore((s) => s.user);
  const isReporter = ["admin", "manager", "subadmin"].includes(me?.role);
  const [anchor, setAnchor] = useState(() => monthStr(new Date()));
  const [team, setTeam] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["appraisal", anchor, team],
    queryFn: () => fetchAppraisal({ month: anchor, team }),
  });

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });

  const shiftMonth = (delta) => {
    const [y, m] = anchor.split("-").map(Number);
    setAnchor(monthStr(new Date(y, m - 1 + delta, 1)));
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-card" />;
  }

  const rows = data?.rows || [];

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="rounded-btn border border-border p-2 text-muted hover:bg-surface hover:text-primary"
          >
            <ChevronLeft size={15} />
          </button>
          <p className="min-w-40 text-center text-sm font-medium">{fmtMonth(`${anchor}-01`)}</p>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="rounded-btn border border-border p-2 text-muted hover:bg-surface hover:text-primary"
          >
            <ChevronRight size={15} />
          </button>
        </div>
        {isReporter && (
          <Select aria-label="Filter by team" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <details className="rounded-card border border-border bg-surface p-4 text-xs text-muted">
        <summary className="cursor-pointer font-medium text-primary">How the monthly score is calculated</summary>
        <p className="mt-2">
          Monthly score = 100 − Total Penalty Points ÷ Tasks Completed
          <br />
          Total Penalty Points = (Leaves × Leave weight) + (Late Marks × Late Mark weight) + (Client Changes ×
          Client Change weight) + (Bugs × Bug weight)
        </p>
        <p className="mt-2">
          Shows <strong>N/A</strong> when someone has completed zero tasks in the month, rather than dividing by
          zero. Weights are admin-configurable under Admin → Leaderboard.
        </p>
        <p className="mt-2">
          Each team sets its own Red/Yellow/Green score cutoffs (under Departments &amp; Teams). A Red month
          automatically issues a performance memo — the first 3 push back the employee&apos;s next review date by 3
          weeks each, the 4th flags the account for admin review.
        </p>
      </details>

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} heading="No one to appraise yet" description="Scores appear here once tasks are completed this month." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Rank</th>
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 text-right font-medium">Tasks done</th>
                <th className="px-4 py-3 text-right font-medium">Leaves</th>
                <th className="px-4 py-3 text-right font-medium">Late marks</th>
                <th className="px-4 py-3 text-right font-medium">Client changes</th>
                <th className="px-4 py-3 text-right font-medium">Bugs</th>
                <th className="px-4 py-3 text-right font-medium">Penalty points</th>
                <th className="px-4 py-3 text-right font-medium">Score</th>
                <th className="px-4 py-3 text-right font-medium">Band</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.user._id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 tabular-nums text-muted">{row.rank}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.user.name}</p>
                    <p className="text-xs text-muted">{row.user.designation || row.user.role}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{row.user.team?.name || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.tasksCompleted}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.leaves}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.lateMarks}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.clientChanges}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.bugs}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.penaltyPoints}</td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${bandTone(row.band)}`}>
                    {row.score === null ? "N/A" : row.score.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${bandTone(row.band)}`}>{bandLabel(row.band)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
