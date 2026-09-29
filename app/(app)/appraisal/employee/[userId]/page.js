"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ClipboardCheck, ShieldAlert } from "lucide-react";

import AppraisalHistoryTable from "@/components/appraisal/AppraisalHistoryTable";
import TrendChart from "@/components/appraisal/TrendChart";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { fetchAppraisalSettings, fetchEmployeeHistory } from "@/services/appraisalsService";
import { useAuthStore } from "@/store/authStore";
import { VIEW_ALL_ROLES } from "@/lib/appraisal";

// HR view of one employee's month-by-month appraisals + trend. Scores are
// the stored (finalized) values — never recomputed for the chart.
export default function EmployeeAppraisalHistoryPage({ params }) {
  const { userId } = use(params);
  const isHr = VIEW_ALL_ROLES.includes(useAuthStore((s) => s.user?.role));
  const { data, isLoading, error } = useQuery({ queryKey: ["appraisal-history", userId], queryFn: () => fetchEmployeeHistory(userId), retry: false });
  const { data: config } = useQuery({ queryKey: ["appraisal-settings"], queryFn: fetchAppraisalSettings, enabled: isHr });

  if (isLoading) return <Skeleton className="mx-auto h-96 max-w-[1000px] rounded-card" />;
  if (error) return <EmptyState icon={ShieldAlert} heading="Not available" description="You don't have access to this employee's appraisals." />;

  const { employee, history } = data;
  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <Link href="/appraisal" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary">
        <ChevronLeft size={15} /> Appraisals
      </Link>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{employee.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {[employee.designation, employee.department?.name, employee.email].filter(Boolean).join(" · ")}
        </p>
      </div>
      {history.length === 0 ? (
        <EmptyState icon={ClipboardCheck} heading="No appraisals yet" />
      ) : (
        <>
          <section className="rounded-card border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold">Monthly performance trend</h2>
            <TrendChart history={history} classifications={config?.settings?.classifications} />
          </section>
          <AppraisalHistoryTable history={history} showStatus />
        </>
      )}
    </div>
  );
}
