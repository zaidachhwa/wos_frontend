// Fallback only, used while /leaderboard/points-config hasn't loaded yet.
// The admin-configured values (fetched via fetchPointsConfig) always win.
export const POINTS_BY_PRIORITY = { low: 5, medium: 10, high: 15 };
export const AUTO_AWARD_RATIO = 0.75;
export const OVERDUE_PENALTY = 5;

export const taskPointCeiling = (priority, points = POINTS_BY_PRIORITY) => points[priority] ?? points.medium;

export const maxBonusFor = (priority, points = POINTS_BY_PRIORITY) =>
  taskPointCeiling(priority, points) - Math.round(taskPointCeiling(priority, points) * AUTO_AWARD_RATIO);
