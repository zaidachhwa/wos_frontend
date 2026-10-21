// Salary increment an appraisal earns from its rating — server-computed
// (appraisal.increment: { group: "leader" | "member", pct }).
export default function IncrementBadge({ increment, showGroup = true }) {
  if (!increment || increment.pct === null || increment.pct === undefined) return <span className="text-xs text-muted">—</span>;
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <span className={`font-semibold tabular-nums ${increment.pct > 0 ? "text-success" : "text-muted"}`}>{Number(increment.pct)}%</span>
      {showGroup && <span className="text-xs text-muted">{increment.group === "leader" ? "team leader rate" : "employee rate"}</span>}
    </span>
  );
}
