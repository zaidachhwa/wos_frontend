// Combines a deadline's UTC date with an "HH:mm" time-of-day into an
// absolute instant. Uses UTC consistently because `deadline` itself is
// stored from a plain <input type="date"> (parsed as UTC midnight) — this
// keeps the combination deterministic regardless of the browser's timezone.
export const combineDeadlineAndTime = (deadline, timeStr) => {
  if (!deadline || !timeStr) return null;
  const d = new Date(deadline);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh, mm));
};

const endOfDayUTC = (deadline) => {
  const d = new Date(deadline);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
};

export const isTaskOverdue = (task, now = new Date()) => {
  if (!task.deadline || task.status === "completed") return false;
  const cutoff = task.endTime ? combineDeadlineAndTime(task.deadline, task.endTime) : endOfDayUTC(task.deadline);
  return cutoff < now;
};
