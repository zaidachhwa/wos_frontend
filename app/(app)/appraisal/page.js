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

const scoreTone = (score) => {
  if (score === null) return "text-muted";
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-danger";
};

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

      <p className="text-xs text-muted">
        Score = 100 − (bugs + client-requested changes) ÷ completed tasks. Shown once someone has completed at
        least 5 tasks in the month.
      </p>

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} heading="No one to appraise yet" description="Scores appear here once tasks are completed this month." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 text-right font-medium">Tasks done</th>
                <th className="px-4 py-3 text-right font-medium">Bugs</th>
                <th className="px-4 py-3 text-right font-medium">Client changes</th>
                <th className="px-4 py-3 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.user._id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.user.name}</p>
                    <p className="text-xs text-muted">{row.user.designation || row.user.role}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{row.user.team?.name || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.totalTasks}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.bugs}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.clientChanges}</td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${scoreTone(row.score)}`}>
                    {row.score === null ? "—" : `${row.score}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
