"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BarChart3, Copy, Download, Flame, FileText } from "lucide-react";

import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Input, Button } from "@/components/ui/Field";
import { fetchTeamReport, downloadTeamReportCsv, fetchWorkLog } from "@/services/reportService";
import { useAuthStore } from "@/store/authStore";

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
  const me = useAuthStore((s) => s.user);
  const isManager = ["admin", "manager"].includes(me?.role);

  const [from, setFrom] = useState(weekAgo());
  const [to, setTo] = useState(dayStr(new Date()));
  const [workLogOpen, setWorkLogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [workLogDate, setWorkLogDate] = useState(dayStr(new Date()));
  const [scope, setScope] = useState("team");

  const { data, isLoading } = useQuery({
    queryKey: ["report", from, to],
    queryFn: () => fetchTeamReport({ from, to }),
    enabled: isManager && Boolean(from && to && from <= to),
  });

  const workLog = useMutation({
    mutationFn: () => fetchWorkLog({ date: workLogDate, scope: isManager ? scope : "personal" }),
  });

  const openWorkLog = () => {
    setCopied(false);
    setWorkLogOpen(true);
    workLog.mutate();
  };

  const copyWorkLog = async () => {
    await navigator.clipboard.writeText(workLog.data?.text || "");
    setCopied(true);
  };

  const rows = data?.rows || [];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          {isManager && (
            <>
              <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {isManager && (
            <div className="flex rounded-btn border border-border p-0.5">
              <button
                type="button"
                onClick={() => setScope("personal")}
                className={`rounded-[calc(var(--radius-btn)-2px)] px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  scope === "personal" ? "bg-primary text-primary-foreground" : "text-muted hover:text-primary"
                }`}
              >
                My worklog
              </button>
              <button
                type="button"
                onClick={() => setScope("team")}
                className={`rounded-[calc(var(--radius-btn)-2px)] px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  scope === "team" ? "bg-primary text-primary-foreground" : "text-muted hover:text-primary"
                }`}
              >
                Team worklog
              </button>
            </div>
          )}
          <Input
            label="Date"
            type="date"
            value={workLogDate}
            onChange={(e) => setWorkLogDate(e.target.value)}
          />
          <Button variant="secondary" onClick={openWorkLog}>
            <FileText size={15} /> Generate EOD work log
          </Button>
          {isManager && (
            <Button
              variant="secondary"
              disabled={!rows.length}
              onClick={() => downloadTeamReportCsv({ from, to })}
            >
              <Download size={15} /> Export CSV
            </Button>
          )}
        </div>
      </div>

      {isManager ? (
        <>
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-card" />
          ) : rows.length ? (
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 font-medium">Person</th>
                    <th className="px-4 py-3 text-right font-medium">Tasks done</th>
                    <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Est. hrs</th>
                    <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Actual hrs</th>
                    <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Open</th>
                    <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Blocked</th>
                    <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">Follow-ups</th>
                    <th className="px-4 py-3 text-right font-medium">Compliance</th>
                    <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">Streak</th>
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
                      <td className="hidden px-4 py-3 text-right tabular-nums text-muted md:table-cell">{r.estimatedHours}</td>
                      <td className="hidden px-4 py-3 text-right tabular-nums text-muted md:table-cell">{r.actualHours}</td>
                      <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{r.openTasks}</td>
                      <td className={`hidden px-4 py-3 text-right tabular-nums sm:table-cell ${r.blockedTasks ? "text-danger" : "text-muted"}`}>
                        {r.blockedTasks}
                      </td>
                      <td className="hidden px-4 py-3 text-right tabular-nums text-muted lg:table-cell">
                        {r.followUpsSubmitted}/{r.followUpsExpected}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium tabular-nums ${complianceTone(r.complianceRate)}`}>
                        {r.complianceRate}%
                      </td>
                      <td className="hidden px-4 py-3 text-right tabular-nums lg:table-cell">
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
        </>
      ) : (
        <p className="text-sm text-muted">Generate your personal end-of-day work log below.</p>
      )}

      <Dialog
        open={workLogOpen}
        onClose={() => setWorkLogOpen(false)}
        title="EOD work log"
        footer={
          <Button onClick={copyWorkLog} disabled={!workLog.data}>
            <Copy size={15} /> {copied ? "Copied!" : "Copy"}
          </Button>
        }
      >
        {workLog.isPending ? (
          <Skeleton className="h-48 w-full rounded-card" />
        ) : workLog.isError ? (
          <p className="text-sm text-danger">Could not generate the work log. Try again.</p>
        ) : (
          <pre className="whitespace-pre-wrap rounded-input border border-border bg-background/60 p-4 font-sans text-sm">
            {workLog.data?.text}
          </pre>
        )}
      </Dialog>
    </div>
  );
}
