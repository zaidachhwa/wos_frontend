"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import ClassificationBadge from "@/components/appraisal/ClassificationBadge";
import MonthPicker from "@/components/appraisal/MonthPicker";
import Skeleton from "@/components/ui/Skeleton";
import { fetchTeamAppraisals } from "@/services/appraisalsService";
import { fmtScore, shiftMonth } from "@/lib/appraisal";

// Team-lead view: the finalized appraisals of people they manage. Drafts
// and HR working notes stay HR-only (enforced server-side).
export default function TeamAppraisals({ initialMonth }) {
  const [month, setMonth] = useState(() => shiftMonth(initialMonth, -1));
  const { data, isLoading } = useQuery({ queryKey: ["team-appraisals", month], queryFn: () => fetchTeamAppraisals(month) });
  const byUser = new Map((data?.appraisals || []).map((a) => [String(a.user?._id || a.user), a]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">My team</h2>
        <MonthPicker month={month} onChange={setMonth} />
      </div>
      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-card" />
      ) : !data?.members?.length ? (
        <p className="rounded-card border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">No team members assigned to you.</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <tbody>
              {data.members.map((m) => {
                const a = byUser.get(String(m._id));
                return (
                  <tr key={m._id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs text-muted">{m.designation || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{a ? `${fmtScore(a.totalScore)} / 100` : "—"}</td>
                    <td className="px-4 py-3">{a ? <ClassificationBadge classification={a.classification} /> : <span className="text-xs text-muted">Not finalized</span>}</td>
                    <td className="px-4 py-3 text-right">
                      {a && (
                        <Link href={`/appraisal/${a._id}`} className="text-sm font-medium text-info hover:underline">
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
