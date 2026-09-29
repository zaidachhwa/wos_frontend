import Link from "next/link";

import ClassificationBadge from "@/components/appraisal/ClassificationBadge";
import Badge from "@/components/ui/Badge";
import { STATUS_LABELS, STATUS_TONES, fmtDateTime, fmtScore, monthLabel } from "@/lib/appraisal";

// Employee identity + the big overall score card. Finalized appraisals show
// the employee as they were at finalization (employeeSnapshot).
export default function ScoreHeader({ appraisal, showHistoryLink }) {
  const snap = appraisal.status === "finalized" ? appraisal.employeeSnapshot : null;
  const u = appraisal.user || {};
  const fields = [
    ["Employee ID", String(u._id || "").slice(-8).toUpperCase()],
    ["Email", snap?.email || u.email],
    ["Department", snap?.departmentName || u.department?.name || "Unassigned"],
    ["Designation", snap?.designation || u.designation || "—"],
    ["Appraisal month", monthLabel(appraisal.month)],
    ["Evaluator", appraisal.finalizedBy?.name || appraisal.evaluator?.name || (appraisal.autoFinalized ? "System (auto-finalized)" : "—")],
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-card border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{snap?.name || u.name}</h1>
          <Badge value={STATUS_LABELS[appraisal.status]} tone={STATUS_TONES[appraisal.status]} />
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {fields.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
              <dd className="mt-0.5 truncate">{v || "—"}</dd>
            </div>
          ))}
        </dl>
        {appraisal.finalizedAt && <p className="mt-4 text-xs text-muted">Finalized {fmtDateTime(appraisal.finalizedAt)}</p>}
        {showHistoryLink && u._id && (
          <Link href={`/appraisal/employee/${u._id}`} className="mt-2 inline-block text-sm font-medium text-info hover:underline">
            View appraisal history →
          </Link>
        )}
      </div>

      <div className="flex flex-col justify-center rounded-card border border-border bg-surface p-5 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Overall performance score</p>
        <p className="mt-2 text-5xl font-semibold tabular-nums">{fmtScore(appraisal.totalScore)}</p>
        <p className="text-sm text-muted">/ 100</p>
        <div className="mt-3">
          <ClassificationBadge classification={appraisal.classification} />
        </div>
      </div>
    </div>
  );
}
