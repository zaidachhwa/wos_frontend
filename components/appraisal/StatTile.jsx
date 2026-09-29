const TONES = { danger: "text-danger", warning: "text-warning", success: "text-success", info: "text-info", muted: "" };

export default function StatTile({ label, value, tone = "muted", hint }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${TONES[tone] || ""}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
