"use client";

import { useRouter } from "next/navigation";

import ClassificationBadge from "@/components/appraisal/ClassificationBadge";
import Badge from "@/components/ui/Badge";
import { STATUS_LABELS, STATUS_TONES, fmtScore, monthLabel } from "@/lib/appraisal";

// Month-by-month appraisal list; every row opens that month's record
// (the immutable snapshot, once finalized).
export default function AppraisalHistoryTable({ history, showStatus = false }) {
  const router = useRouter();
  const open = (id) => router.push(`/appraisal/${id}`);
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Month</th>
            <th className="px-4 py-3 text-right font-medium">Score</th>
            <th className="px-4 py-3 font-medium">Classification</th>
            {showStatus && <th className="px-4 py-3 font-medium">Status</th>}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {history.map((h) => (
            <tr key={h._id} className="border-b border-border/60 last:border-0 hover:bg-background">
              <td className="px-4 py-3 font-medium">{monthLabel(h.month)}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtScore(h.totalScore)} / 100</td>
              <td className="px-4 py-3">
                <ClassificationBadge classification={h.classification} />
              </td>
              {showStatus && (
                <td className="px-4 py-3">
                  <Badge value={STATUS_LABELS[h.status]} tone={STATUS_TONES[h.status]} />
                </td>
              )}
              <td className="px-4 py-3 text-right">
                <button type="button" onClick={() => open(h._id)} className="text-sm font-medium text-info hover:underline">
                  View details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
