// Display helpers for the appraisal module. Formatting only — every number
// shown comes from the backend engine; nothing here computes a score.

export const HR_ROLES = ["admin", "hr"];
export const VIEW_ALL_ROLES = ["admin", "hr", "director"];
export const TEAM_LEAD_ROLES = ["manager", "sublead", "subadmin"];
export const BUG_ROLES = ["admin", "hr", "director", "manager", "sublead", "subadmin", "qa"];

const pad = (n) => String(n).padStart(2, "0");

// Current month in IST (Asia/Kolkata), regardless of the viewer's timezone —
// matches the backend's month boundaries.
export const currentIstMonth = () => {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}`;
};

export const shiftMonth = (month, delta) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

export const monthLabel = (month) => {
  if (!month) return "";
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
};

export const fmtScore = (n) => (n === null || n === undefined ? "—" : Number(n).toFixed(2));
export const fmtPct = (n) => (n === null || n === undefined ? "—" : `${Number(n).toFixed(2)}%`);
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const STATUS_LABELS = {
  draft: "Draft",
  in_progress: "In progress",
  pending_hr_input: "Pending HR input",
  ready_for_review: "Ready for review",
  submitted: "Submitted",
  finalized: "Finalized",
  reopened: "Reopened",
};

export const STATUS_TONES = {
  draft: "muted",
  in_progress: "info",
  pending_hr_input: "warning",
  ready_for_review: "info",
  submitted: "info",
  finalized: "success",
  reopened: "warning",
};

export const TYPE_LABELS = { automatic: "Automatic", manual: "Manual", hybrid: "Hybrid" };

export const METHOD_LABELS = {
  ratio: "Ratio (metric is a %)",
  target: "Target (metric ÷ target)",
  deduction: "Deduction per unit",
  bands: "Score bands",
  rating: "HR rating",
};

export const EMAIL_TONES = { pending: "muted", processing: "info", sent: "success", failed: "danger", retrying: "warning" };

export const apiError = (error) => error?.response?.data?.message || "Something went wrong";
