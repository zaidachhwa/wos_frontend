export const POINTS_BY_PRIORITY = { low: 5, medium: 10, high: 15, critical: 25 };
export const AUTO_AWARD_RATIO = 0.75;
export const OVERDUE_PENALTY = 5;

export const taskPointCeiling = (priority) => POINTS_BY_PRIORITY[priority] ?? POINTS_BY_PRIORITY.medium;

export const maxBonusFor = (priority) =>
  taskPointCeiling(priority) - Math.round(taskPointCeiling(priority) * AUTO_AWARD_RATIO);
