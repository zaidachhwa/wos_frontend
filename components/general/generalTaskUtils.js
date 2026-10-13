// Shared display helpers for the General section. Statuses come from the
// server (completed / delayed / overdue / pending) — never derived here.

export const STATUS_META = {
  pending: { label: "Pending", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  delayed: { label: "Delayed", tone: "warning" },
  overdue: { label: "Overdue", tone: "danger" },
};

export const STATUS_HELP = {
  pending: "Not done yet, still before the due time",
  completed: "Done on or before the due time",
  delayed: "Done, but after the due time",
  overdue: "Past the due time and still not done",
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// <input type="datetime-local"> value ("2026-10-15T17:00") ⇄ instant, always
// read as IST so the due time means the same thing for everyone.
export const istInputToIso = (value) => (value ? new Date(`${value}:00+05:30`).toISOString() : "");
export const isoToIstInput = (iso) => (iso ? new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 16) : "");

export const fmtDue = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
