"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, RotateCcw, ShieldAlert } from "lucide-react";

import AppraisalTabs from "@/components/appraisal/AppraisalTabs";
import MonthPicker from "@/components/appraisal/MonthPicker";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Button, Select } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { useAuthStore } from "@/store/authStore";
import { closePeriod, fetchEmailLogs, fetchPeriods, retryEmailLog } from "@/services/appraisalsService";
import { EMAIL_TONES, HR_ROLES, apiError, currentIstMonth, fmtDateTime, monthLabel, shiftMonth } from "@/lib/appraisal";

// Delivery status of the monthly appraisal emails (sent at 00:01 IST on the
// 1st for the previous month), plus the month-close runs that produce them.
export default function AppraisalEmailsPage() {
  const isHr = HR_ROLES.includes(useAuthStore((s) => s.user?.role));
  const toast = useToast();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => shiftMonth(currentIstMonth(), -1));
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["appraisal-emails", month, status], queryFn: () => fetchEmailLogs({ month, status }), enabled: isHr });
  const { data: periods = [] } = useQuery({ queryKey: ["appraisal-periods"], queryFn: fetchPeriods, enabled: isHr });
  const period = periods.find((p) => p.month === month);

  const retry = useMutation({
    mutationFn: retryEmailLog,
    onSuccess: () => {
      toast.success("Email queued for retry");
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["appraisal-emails"] }), 1500);
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const close = useMutation({
    mutationFn: () => closePeriod(month),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["appraisal-periods"] });
      queryClient.invalidateQueries({ queryKey: ["appraisals"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (!isHr) return <EmptyState icon={ShieldAlert} heading="HR only" />;
  const logs = data?.logs || [];

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Appraisal email log</h1>
          <p className="mt-1 text-sm text-muted">Each month&apos;s appraisal is emailed at 00:01 IST on the 1st of the next month, once per employee.</p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>
      <AppraisalTabs />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-4 text-sm">
        <div>
          <p className="font-medium">Month close — {monthLabel(month)}</p>
          <p className="text-xs text-muted">
            {period?.status === "closed"
              ? `Closed ${fmtDateTime(period.closedAt)} · ${period.closeSummary?.finalized ?? 0} auto-finalized · ${period.closeSummary?.incomplete ?? 0} awaiting HR`
              : "Not closed yet — runs automatically at 00:01 IST on the 1st."}
          </p>
        </div>
        {period?.status !== "closed" && month < currentIstMonth() && (
          <Button variant="secondary" disabled={close.isPending} onClick={() => close.mutate()}>
            Close month now
          </Button>
        )}
      </section>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {Object.keys(EMAIL_TONES).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        {data && (
          <p className="pb-2 text-xs text-muted">
            {Object.entries(data.counts)
              .filter(([, n]) => n)
              .map(([s, n]) => `${n} ${s}`)
              .join(" · ") || "No emails"}
          </p>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-card" />
      ) : logs.length === 0 ? (
        <EmptyState icon={Mail} heading="No emails for this month" description="Emails are queued once appraisals are finalized and the month has ended." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Recipient</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sent at</th>
                <th className="px-4 py-3 text-right font-medium">Attempts</th>
                <th className="px-4 py-3 font-medium">Error</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium">{l.user?.name}</td>
                  <td className="px-4 py-3 text-muted">{l.recipient}</td>
                  <td className="px-4 py-3">
                    <Badge value={l.status} tone={EMAIL_TONES[l.status]} />
                  </td>
                  <td className="px-4 py-3 text-muted">{fmtDateTime(l.sentAt)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.attempts}</td>
                  <td className="max-w-64 truncate px-4 py-3 text-xs text-danger" title={l.lastError}>
                    {l.lastError || ""}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {l.status === "failed" && (
                      <Button variant="ghost" disabled={retry.isPending} onClick={() => retry.mutate(l._id)}>
                        <RotateCcw size={14} /> Retry
                      </Button>
                    )}
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
