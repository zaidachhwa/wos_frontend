"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, Flame } from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Input, Button } from "@/components/ui/Field";
import { fetchTeamReport, downloadTeamReportCsv } from "@/services/reportService";

const pad = (n) => String(n).padStart(2, "0");
const dayStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const weekAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return dayStr(d);
};

const complianceTone = (rate) =>
  rate >= 80 ? "text-success" : rate >= 50 ? "text-warning" : "text-danger";

export default function ReportsPage() {
  const [from, setFrom] = useState(weekAgo());
  const [to, setTo] = useState(dayStr(new Date()));

  const { data, isLoading } = useQuery({
    queryKey: ["report", from, to],
    queryFn: () => fetchTeamReport({ from, to }),
    enabled: Boolean(from && to && from <= to),
  });

  const rows = data?.rows || [];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button
          variant="secondary"
          disabled={!rows.length}
          onClick={() => downloadTeamReportCsv({ from, to })}
        >
          <Download size={15} /> Export CSV
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-card" />
      ) : rows.length ? (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 text-right font-medium">Tasks done</th>
                <th className="px-4 py-3 text-right font-medium">Est. hrs</th>
                <th className="px-4 py-3 text-right font-medium">Actual hrs</th>
                <th className="px-4 py-3 text-right font-medium">Open</th>
                <th className="px-4 py-3 text-right font-medium">Blocked</th>
                <th className="px-4 py-3 text-right font-medium">Follow-ups</th>
                <th className="px-4 py-3 text-right font-medium">Compliance</th>
                <th className="px-4 py-3 text-right font-medium">Streak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user._id} className="border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-background">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.user.name}</p>
                    <p className="text-xs text-muted">{r.user.designation || r.user.role}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.tasksCompleted}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{r.estimatedHours}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{r.actualHours}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.openTasks}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${r.blockedTasks ? "text-danger" : "text-muted"}`}>
                    {r.blockedTasks}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {r.followUpsSubmitted}/{r.followUpsExpected}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium tabular-nums ${complianceTone(r.complianceRate)}`}>
                    {r.complianceRate}%
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      {r.morningStreak > 2 && <Flame size={13} className="text-warning" />}
                      {r.morningStreak}d
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={BarChart3}
          heading="No reports to show"
          description="People reporting to you (or all active users, for admins) will appear here."
        />
      )}

      <p className="text-xs text-muted">
        Compliance = submitted follow-ups / (working days × 2). Streak = consecutive weekdays with a
        submitted morning follow-up. Hours are summed over tasks completed in the range.
      </p>
    </div>
  );
}
