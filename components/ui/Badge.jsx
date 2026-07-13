const TONES = {
  muted: "bg-border/60 text-muted",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

const VALUE_TONES = {
  // priority
  low: "muted",
  medium: "info",
  high: "warning",
  critical: "danger",
  // task status
  backlog: "muted",
  todo: "muted",
  in_progress: "info",
  review: "warning",
  testing: "warning",
  completed: "success",
  blocked: "danger",
  // project status
  planning: "muted",
  active: "info",
  on_hold: "warning",
  cancelled: "danger",
  // follow-up status
  draft: "muted",
  submitted: "info",
  reviewed: "success",
  missing: "danger",
};

export default function Badge({ value, tone }) {
  const resolved = TONES[tone || VALUE_TONES[value] || "muted"];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${resolved}`}>
      {String(value).replace(/_/g, " ")}
    </span>
  );
}
