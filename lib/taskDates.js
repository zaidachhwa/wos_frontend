// Combines a deadline's calendar date with an "HH:mm" wall-clock time into
// an absolute instant, entirely in the browser's own local timezone — the
// same convention TimeBlockDialog.jsx already uses for its date+time
// inputs. The date portion is read from `deadline`'s UTC ISO components
// (timezone-safe, since `deadline` is stored from a date-only input at UTC
// midnight) so the calendar day itself never shifts; only the time-of-day
// is then interpreted as local, matching what the user actually typed into
// an <input type="time">.
const OVERDUE_EXEMPT_STATUSES = ["completed", "client_review"];

export const combineDeadlineAndTime = (deadline, timeStr) => {
  if (!deadline || !timeStr) return null;
  const dateStr = new Date(deadline).toISOString().slice(0, 10);
  return new Date(`${dateStr}T${timeStr}`);
};

const endOfDayLocal = (deadline) => {
  const dateStr = new Date(deadline).toISOString().slice(0, 10);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const isTaskOverdue = (task, now = new Date()) => {
  if (!task.deadline || OVERDUE_EXEMPT_STATUSES.includes(task.status)) return false;
  const cutoff = task.endTime ? combineDeadlineAndTime(task.deadline, task.endTime) : endOfDayLocal(task.deadline);
  return cutoff < now;
};
