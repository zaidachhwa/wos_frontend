const TONES = {
  muted: "bg-border/60 text-muted",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

// Same pill as ui/Badge, minus its `capitalize` — classification labels are
// HR-authored sentences and must render exactly as written. Label and tone
// come from the appraisal's own (possibly historical) classification.
export default function ClassificationBadge({ classification }) {
  if (!classification?.label) return <span className="text-xs text-muted">—</span>;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[classification.tone] || TONES.muted}`}>
      {classification.label}
    </span>
  );
}
