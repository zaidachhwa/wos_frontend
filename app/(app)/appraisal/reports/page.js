"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, FileDown, ShieldAlert } from "lucide-react";

import AppraisalFilters from "@/components/appraisal/AppraisalFilters";
import AppraisalTabs from "@/components/appraisal/AppraisalTabs";
import MonthPicker from "@/components/appraisal/MonthPicker";
import EmptyState from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { useAuthStore } from "@/store/authStore";
import { downloadAppraisalReportCsv, fetchAppraisalReport, fetchAppraisalSettings } from "@/services/appraisalsService";
import { fetchDepartments, fetchUsers } from "@/services/orgService";
import { exportSectionsToPDF, exportWorkbook } from "@/lib/exportUtils";
import { VIEW_ALL_ROLES, apiError, currentIstMonth, monthLabel, shiftMonth } from "@/lib/appraisal";

const title = (s) => s.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const relabel = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [title(k), v])));

// Department-wise monthly report. The backend assembles every number; the
// browser only lays it out as a 5-sheet workbook / PDF / CSV.
export default function AppraisalReportsPage() {
  const canView = VIEW_ALL_ROLES.includes(useAuthStore((s) => s.user?.role));
  const toast = useToast();
  const [month, setMonth] = useState(() => shiftMonth(currentIstMonth(), -1));
  const [filters, setFilters] = useState({});
  const [busy, setBusy] = useState(false);
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: fetchDepartments, enabled: canView });
  const { data: config } = useQuery({ queryKey: ["appraisal-settings"], queryFn: fetchAppraisalSettings, enabled: canView });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: fetchUsers, enabled: canView });
  const designations = [...new Set(users.map((u) => u.designation).filter(Boolean))].sort();

  if (!canView) return <EmptyState icon={ShieldAlert} heading="HR only" description="Appraisal reports are available to HR and administrators." />;

  const scope = [monthLabel(month), departments.find((d) => d._id === filters.department)?.name].filter(Boolean).join(" · ");
  const filename = `appraisal-report-${month}${filters.department ? `-${(departments.find((d) => d._id === filters.department)?.name || "dept").replace(/\s+/g, "-")}` : ""}`;

  const run = async (kind) => {
    setBusy(true);
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
      if (kind === "xlsx") {
        exportWorkbook(
          [
            { name: "Summary", rows: relabel(r.summary) },
            { name: "Detailed Criteria", rows: relabel(r.criteria) },
            { name: "Automatic Metrics", rows: relabel(r.automatic) },
            { name: "HR Metrics", rows: relabel(r.hr) },
            { name: "Department Summary", rows: relabel(r.departments) },
          ],
          `${filename}.xlsx`
        );
      } else {
        const table = (rows) => ({ headers: Object.keys(rows[0] || {}).map(title), rows: rows.map((x) => Object.values(x)) });
        exportSectionsToPDF(
          `Monthly Performance Appraisal Report — ${scope}`,
          [
            { title: "Summary", ...table(r.summary) },
            { title: "Department Summary", ...table(r.departments) },
            { title: "Automatic Metrics", ...table(r.automatic) },
            { title: "HR Metrics", ...table(r.hr) },
            { title: "Detailed Criteria", ...table(r.criteria) },
          ],
          `${filename}.pdf`
        );
      }
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Appraisal reports</h1>
          <p className="mt-1 text-sm text-muted">Monthly reports by department, designation, classification or score range.</p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>
      <AppraisalTabs />
      <AppraisalFilters
        filters={filters}
        onChange={setFilters}
        departments={departments}
        designations={designations}
        classifications={config?.settings?.classifications || []}
      />
      <section className="rounded-card border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Generate report — {scope}</h2>
        <p className="mt-1 text-xs text-muted">
          Excel contains five sheets: Summary, Detailed Criteria, Automatic Metrics, HR Metrics and Department Summary.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => run("xlsx")}>
            <FileSpreadsheet size={15} /> Excel (.xlsx)
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => run("pdf")}>
            <FileText size={15} /> PDF
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => run("csv")}>
            <FileDown size={15} /> CSV (summary)
          </Button>
        </div>
      </section>
    </div>
  );
}
