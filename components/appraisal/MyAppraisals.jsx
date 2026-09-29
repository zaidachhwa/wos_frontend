"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";

import AppraisalHistoryTable from "@/components/appraisal/AppraisalHistoryTable";
import TrendChart from "@/components/appraisal/TrendChart";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { fetchMyAppraisals } from "@/services/appraisalsService";

// Employee view: own finalized monthly appraisals only (the API never
// returns drafts or anyone else's).
export default function MyAppraisals() {
  const { data: history = [], isLoading } = useQuery({ queryKey: ["my-appraisals"], queryFn: fetchMyAppraisals });

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My appraisals</h1>
        <p className="mt-1 text-sm text-muted">Your monthly performance appraisals, available once HR finalizes each month.</p>
      </div>
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-card" />
      ) : history.length === 0 ? (
        <EmptyState icon={ClipboardCheck} heading="No appraisals yet" description="Your first appraisal appears here after its month is finalized." />
      ) : (
        <>
          <div className="rounded-card border border-border bg-surface p-5">
            <p className="mb-3 text-sm font-semibold">Score trend</p>
            <TrendChart history={history} />
          </div>
          <AppraisalHistoryTable history={history} />
        </>
      )}
    </div>
  );
}
