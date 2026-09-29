"use client";

import { useQuery } from "@tanstack/react-query";

import Dialog from "@/components/ui/Dialog";
import Skeleton from "@/components/ui/Skeleton";
import { fetchAppraisalAudit } from "@/services/appraisalsService";
import { fmtDateTime } from "@/lib/appraisal";

const summarize = (v) => {
  if (v === null || v === undefined) return "—";
  if (typeof v !== "object") return String(v);
  return Object.entries(v)
    .map(([k, val]) => `${k}: ${typeof val === "object" && val !== null ? JSON.stringify(val) : val ?? "—"}`)
    .join(", ");
};

export default function AuditTrailDialog({ appraisalId, open, onClose }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["appraisal-audit", appraisalId],
    queryFn: () => fetchAppraisalAudit(appraisalId),
    enabled: open,
  });

  return (
    <Dialog open={open} onClose={onClose} title="Audit trail">
      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-card" />
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted">No recorded changes yet.</p>
      ) : (
        <ol className="space-y-3 text-sm">
          {logs.map((l) => (
            <li key={l._id} className="border-b border-border/60 pb-3 last:border-0">
              <p className="font-medium capitalize">{l.action.replace(/_/g, " ")}</p>
              <p className="text-xs text-muted">
                {l.actor?.name || "System"} · {fmtDateTime(l.createdAt)}
                {l.meta?.criterionKey ? ` · ${l.meta.criterionKey}` : ""}
              </p>
              {(l.before || l.after) && (
                <p className="mt-1 break-words text-xs">
                  {summarize(l.before)} → {summarize(l.after)}
                </p>
              )}
              {l.meta?.reason && <p className="mt-1 text-xs">Reason: {l.meta.reason}</p>}
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  );
}
