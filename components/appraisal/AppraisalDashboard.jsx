"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ClipboardCheck, FileDown, FileSpreadsheet, FileText, Lock } from "lucide-react";

import AppraisalTabs from "@/components/appraisal/AppraisalTabs";
import AppraisalFilters from "@/components/appraisal/AppraisalFilters";
import ClassificationBadge from "@/components/appraisal/ClassificationBadge";
import MonthPicker from "@/components/appraisal/MonthPicker";
import StatTile from "@/components/appraisal/StatTile";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { useAuthStore } from "@/store/authStore";
import { downloadAppraisalReportCsv, fetchAppraisalReport, fetchAppraisals, finalizeMonth } from "@/services/appraisalsService";
import { fetchDepartments, fetchTeams } from "@/services/orgService";
import { exportSectionsToPDF, exportWorkbook } from "@/lib/exportUtils";
import { HR_ROLES, STATUS_LABELS, STATUS_TONES, apiError, fmtDateTime, fmtScore, monthLabel } from "@/lib/appraisal";

const title = (s) => s.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const relabel = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [title(k), v])));

export default function AppraisalDashboard({ initialMonth }) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canManage = HR_ROLES.includes(useAuthStore((s) => s.user?.role));
  const [month, setMonth] = useState(initialMonth);
  const [filters, setFilters] = useState({});
  const [exportBusy, setExportBusy] = useState(false);
  // Server-side filtering; the search box is deferred so typing stays snappy.
  const deferredFilters = useDeferredValue(filters);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["appraisals", month, deferredFilters],
    queryFn: () => fetchAppraisals({ month, ...deferredFilters }),
    placeholderData: (prev) => prev,
  });
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: fetchDepartments });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });

  const finalizeAll = useMutation({
    mutationFn: () => finalizeMonth({ month }),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["appraisals"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const rows = useMemo(() => data?.rows || [], [data]);
  const designations = useMemo(() => [...new Set(rows.map((r) => r.user.designation).filter(Boolean))].sort(), [rows]);
  const classifications = data?.classifications || [];
  const monthEnded = data ? new Date() > new Date(data.period.endAt) : false;
  const readyCount = rows.filter((r) => ["ready_for_review", "submitted"].includes(r.status)).length;

  // ---- export helpers ----
  const scope = [monthLabel(month), departments.find((d) => d._id === filters.department)?.name, teams.find((t) => t._id === filters.team)?.name]
    .filter(Boolean)
    .join(" · ");

  const filename = `appraisal-${month}${filters.department ? `-${(departments.find((d) => d._id === filters.department)?.name || "dept").replace(/\s+/g, "-")}` : ""}${filters.team ? `-${(teams.find((t) => t._id === filters.team)?.name || "team").replace(/\s+/g, "-")}` : ""}`;

  const runExport = async (kind) => {
    setExportBusy(true);
    try {
      if (kind === "csv") {
        await downloadAppraisalReportCsv({ month, ...filters });
        return;
      }
      const r = await fetchAppraisalReport({ month, ...filters });
      if (!r.summary.length) {
        toast.info("No appraisals match these filters");
        return;
      }
      // Derive title/filename from the server-confirmed month so the PDF header
      // always matches the actual data, regardless of any React state race.
      const rMonth = r.month || month;
      const rDeptName = departments.find((d) => d._id === filters.department)?.name;
      const rTeamName = teams.find((t) => t._id === filters.team)?.name;
      const rScope = [monthLabel(rMonth), rDeptName, rTeamName].filter(Boolean).join(" · ");
      const rFile = `appraisal-${rMonth}${rDeptName ? `-${rDeptName.replace(/\s+/g, "-")}` : ""}${rTeamName ? `-${rTeamName.replace(/\s+/g, "-")}` : ""}`;

      if (kind === "xlsx") {
        exportWorkbook(
          [
            { name: "Summary", rows: relabel(r.summary) },
            { name: "Detailed Criteria", rows: relabel(r.criteria) },
            { name: "Automatic Metrics", rows: relabel(r.automatic) },
            { name: "HR Metrics", rows: relabel(r.hr) },
            { name: "Department Summary", rows: relabel(r.departments) },
          ],
          `${rFile}.xlsx`
        );
      } else {
        const table = (rows) => ({ headers: Object.keys(rows[0] || {}).map(title), rows: rows.map((x) => Object.values(x)) });
        exportSectionsToPDF(
          `Monthly Performance Appraisal Report — ${rScope}`,
          [
            { title: "Summary", ...table(r.summary) },
            { title: "Department Summary", ...table(r.departments) },
            { title: "Automatic Metrics", ...table(r.automatic) },
            { title: "HR Metrics", ...table(r.hr) },
            { title: "Detailed Criteria", ...table(r.criteria) },
          ],
          `${rFile}.pdf`
        );
      }
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Performance appraisals</h1>
          <p className="mt-1 text-sm text-muted">Monthly appraisal scores out of 100, calculated from WOS data, HR inputs and HR evaluations.</p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>
      <AppraisalTabs />

      {data && !data.weightage.valid && (
        <div role="alert" className="flex items-start gap-2 rounded-card border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {data.weightage.message} Appraisals can&apos;t be finalized until this is fixed in{" "}
            <Link href="/appraisal/settings" className="underline">
              Settings
            </Link>
            .
          </span>
        </div>
      )}
      {data?.periodStatus?.status === "closed" && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Lock size={13} /> {monthLabel(month)} was closed {fmtDateTime(data.periodStatus.closedAt)}.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatTile label="Employees" value={data?.stats.totalEmployees ?? "—"} />
        <StatTile label="Completed" value={data?.stats.completed ?? "—"} tone="success" hint="Finalized" />
        <StatTile label="Pending" value={data?.stats.pending ?? "—"} tone="warning" />
        {classifications.map((c) => (
          <StatTile key={c.key} label={c.label} value={data?.stats.byClassification?.[c.key] ?? 0} tone={c.tone} />
        ))}
        <StatTile label="Average score" value={data ? fmtScore(data.stats.averageScore) : "—"} />
      </div>

      <AppraisalFilters
        filters={filters}
        onChange={setFilters}
        departments={departments}
        teams={teams}
        designations={designations}
        classifications={classifications}
      />

      {/* Export row */}
      {canManage && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface px-4 py-3">
          <span className="mr-1 text-xs font-medium text-muted">Export {scope ? `— ${scope}` : ""}:</span>
          <Button size="sm" variant="secondary" disabled={exportBusy} onClick={() => runExport("xlsx")}>
            <FileSpreadsheet size={14} /> Excel (.xlsx)
          </Button>
          <Button size="sm" variant="secondary" disabled={exportBusy} onClick={() => runExport("pdf")}>
            <FileText size={14} /> PDF
          </Button>
          <Button size="sm" variant="secondary" disabled={exportBusy} onClick={() => runExport("csv")}>
            <FileDown size={14} /> CSV
          </Button>
        </div>
      )}

      {canManage && monthEnded && readyCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-4">
          <p className="text-sm">
            <span className="font-medium">{readyCount}</span> appraisal{readyCount === 1 ? " is" : "s are"} complete and ready to finalize.
          </p>
          <Button disabled={finalizeAll.isPending} onClick={() => finalizeAll.mutate()}>
            {finalizeAll.isPending ? "Finalizing…" : "Finalize all complete"}
          </Button>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-80 w-full rounded-card" />
      ) : isError ? (
        <EmptyState icon={AlertTriangle} heading="Couldn't load appraisals" description="Please try again." action={<Button onClick={() => refetch()}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} heading="No appraisals match" description="Try a different month or clear the filters." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Designation</th>
                <th className="px-4 py-3 text-right font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Classification</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Missing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r._id}
                  tabIndex={0}
                  onClick={() => router.push(`/appraisal/${r._id}`)}
                  onKeyDown={(e) => e.key === "Enter" && router.push(`/appraisal/${r._id}`)}
                  className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-background focus:bg-background focus:outline-none"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.user.name}</p>
                    <p className="text-xs text-muted">{r.user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{r.department.name}</td>
                  <td className="px-4 py-3 text-muted">{r.team?.name || "—"}</td>
                  <td className="px-4 py-3 text-muted">{r.user.designation || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtScore(r.totalScore)}</td>
                  <td className="px-4 py-3">
                    <ClassificationBadge classification={r.classification} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge value={STATUS_LABELS[r.status]} tone={STATUS_TONES[r.status]} />
                  </td>
                  <td className="max-w-56 truncate px-4 py-3 text-xs text-muted" title={r.missingInputs.join(", ")}>
                    {r.missingInputs.length ? r.missingInputs.join(", ") : "—"}
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
