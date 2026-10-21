"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";

import MonthPicker from "@/components/appraisal/MonthPicker";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { fetchBonusRequests } from "@/services/peopleService";
import { currentIstMonth } from "@/lib/appraisal";

// HR / Admin / Director view of the month's bonus requests. The bonus itself
// is granted on Appraisal → Director & bonus.
export default function BonusRequestList() {
  const [month, setMonth] = useState(currentIstMonth);
  const { data, isLoading } = useQuery({ queryKey: ["bonus-requests", month], queryFn: () => fetchBonusRequests(month) });
  const requests = data?.requests || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthPicker month={month} onChange={setMonth} />
        <Link href="/appraisal/director" className="text-sm font-medium text-info hover:underline">
          Grant special bonus % →
        </Link>
      </div>
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-card" />
      ) : requests.length === 0 ? (
        <EmptyState icon={Award} heading="No bonus requests this month" />
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r._id} className="rounded-card border border-border bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {r.user?.name} <span className="text-xs font-normal text-muted">{[r.user?.designation, r.user?.department?.name].filter(Boolean).join(" · ")}</span>
                </p>
                <p className="text-xs text-muted">
                  {new Date(r.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{r.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
