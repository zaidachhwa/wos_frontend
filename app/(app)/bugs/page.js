"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bug, Plus, ShieldAlert } from "lucide-react";

import AppraisalTabs from "@/components/appraisal/AppraisalTabs";
import MonthPicker from "@/components/appraisal/MonthPicker";
import BugDialog from "@/components/bugs/BugDialog";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Button, Select } from "@/components/ui/Field";
import { useAuthStore } from "@/store/authStore";
import { fetchBugs } from "@/services/bugService";
import { BUG_ROLES, HR_ROLES, currentIstMonth } from "@/lib/appraisal";

const STATUS_TONES = { reported: "warning", confirmed: "danger", resolved: "success", rejected: "muted" };
const SEVERITY_TONES = { critical: "danger", major: "warning", minor: "info" };

// Bug reports that feed the appraisal. HR sees and reviews everything; a
// team lead sees bugs for their own people and ones they reported (the API
// enforces the scope).
export default function BugsPage() {
  const me = useAuthStore((s) => s.user);
  const isHr = HR_ROLES.includes(me?.role);
  const canReport = BUG_ROLES.includes(me?.role) && me?.role !== "director";
  const [month, setMonth] = useState(currentIstMonth);
  const [filters, setFilters] = useState({ status: "", severity: "" });
  const [dialog, setDialog] = useState(null); // { bug } | { bug: null } for new

  const { data, isLoading, error } = useQuery({
    queryKey: ["bugs", month, filters],
    queryFn: () => fetchBugs({ month, ...filters }),
    enabled: BUG_ROLES.includes(me?.role),
    retry: false,
  });

  if (!BUG_ROLES.includes(me?.role) || error?.response?.status === 403) {
    return <EmptyState icon={ShieldAlert} heading="Not available" description="Bug reporting is for HR and team leads." />;
  }

  const bugs = data?.bugs || [];
  const severities = data?.severities || [];
  const canEdit = (b) => isHr || (String(b.reportedBy?._id) === String(me?._id) && b.status === "reported");

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Bugs</h1>
          <p className="mt-1 text-sm text-muted">Bugs reported against employees. Team-lead reports count toward the appraisal once HR confirms them.</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthPicker month={month} onChange={setMonth} />
          {canReport && (
            <Button onClick={() => setDialog({ bug: null })}>
              <Plus size={15} /> Report bug
            </Button>
          )}
        </div>
      </div>
      <AppraisalTabs />

      <div className="flex flex-wrap gap-3">
        <div className="w-48">
          <Select label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All</option>
            {Object.keys(STATUS_TONES).map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-48">
          <Select label="Severity" value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })}>
            <option value="">All</option>
            {severities.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-card" />
      ) : bugs.length === 0 ? (
        <EmptyState icon={Bug} heading="No bugs this month" description="Reported bugs show up here." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Bug</th>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Penalty</th>
                <th className="px-4 py-3 font-medium">Reported by</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {bugs.map((b) => (
                <tr
                  key={b._id}
                  tabIndex={0}
                  onClick={() => setDialog({ bug: b })}
                  onKeyDown={(e) => e.key === "Enter" && setDialog({ bug: b })}
                  className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-background focus:bg-background focus:outline-none"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{b.title}</p>
                    <p className="text-xs text-muted">{b.project?.name || "—"}</p>
                  </td>
                  <td className="px-4 py-3">{b.employee?.name}</td>
                  <td className="px-4 py-3">
                    <Badge value={severities.find((s) => s.key === b.severity)?.label || b.severity} tone={SEVERITY_TONES[b.severity] || "muted"} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge value={b.status} tone={STATUS_TONES[b.status]} />
                    {!b.includeInAppraisal && <span className="ml-2 text-xs text-muted">excluded</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{b.penalty ? `−${b.penalty}` : "0"}</td>
                  <td className="px-4 py-3 text-muted">
                    {b.reportedBy?.name} <span className="text-xs capitalize">({b.reporterRole})</span>
                  </td>
                  <td className="px-4 py-3 text-muted">{b.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BugDialog
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        bug={dialog?.bug || null}
        severities={severities}
        isHr={isHr}
        canEdit={dialog?.bug ? canEdit(dialog.bug) : true}
      />
    </div>
  );
}
