# Task Accountability: Overdue Penalty, Bug Tracking, Time-in-Status, Client Review

Date: 2026-07-30

## Problem

Team feedback wants four related additions to task/points accountability:

1. A live, one-time point deduction the moment a task's deadline+time passes while still incomplete (distinct from the existing "completed late" penalty, which only fires at completion).
2. A "Bugs" section per project — a buggy task, optionally referencing what it came from, mandatorily tagged to the module(s) it affects, visually flagged red/jira-style, and worth a 1-point accountability deduction to its assignee(s) the moment it's logged.
3. A per-task time-in-status breakdown ("2h in progress, 4h in review") plus a total working-time figure.
4. A new `client_review` task status that is exempt from the overdue tag and the new overdue-penalty sweep while a task sits in it (other departments are boarding onto this app and need this stage).

All new point values must be admin-configurable from the existing leaderboard settings screen.

## Scope

Backend: `Task`/`LeaderboardConfig` schema changes, one new lightweight interval sweep (no cron dependency — none exists in this codebase and none is needed elsewhere), extended points/leaderboard computation, extended task validation.
Frontend: new "Bugs" project tab, bug-aware `TaskDialog`/`TaskDrawer`/`Badge`, time-in-status display, extended admin settings form, `client_review` added to the three existing status arrays.

Out of scope: retroactively forgiving the existing 5-pt "completed late" penalty for tasks that merely passed through `client_review` at some point (see Design decisions below) — only the *current* status is checked, both for the overdue tag and for the new sweep.

## Data model

**`backend/src/models/Task.js`**
- `type: { type: String, enum: ["task", "bug"], default: "task" }`
- `reference: { type: String, default: "" }` — optional free text/link for what a bug came from.
- `overduePenaltyApplied: { type: Boolean, default: false }` — guards the one-time sweep deduction.

**`backend/src/constants/enums.constants.js`**
- `TASK_STATUSES` gains `"client_review"`, inserted between `testing` and `completed`: `["backlog", "todo", "in_progress", "review", "testing", "client_review", "completed", "blocked"]`.
- New `OVERDUE_EXEMPT_STATUSES = ["completed", "client_review"]`, the single source of truth for "this task is not overdue-eligible right now."

**`backend/src/models/LeaderboardConfig.js`**
- Add `penalties: { completedLate: Number, overdue: Number, bug: Number }` (required, defaults 5/2/1) alongside the existing `pointsByPriority`. Same singleton document.

**`backend/src/constants/points.constants.js`**
- Add `OVERDUE_UNCOMPLETED_PENALTY = 2` and `BUG_PENALTY = 1` as the seed defaults (existing `OVERDUE_PENALTY = 5` stays, renamed in the config layer to `completedLate` — the constant itself is untouched, just addressed differently once read through `pointsConfig.js`).

Frontend mirrors: `frontend/constants/points.constants.js` gets the same two new fallback constants (this file already exists as a fallback-only mirror of the backend one, per its own comment).

## Backend logic

**`backend/src/utils/pointsConfig.js`**: extend the in-memory cache and `LeaderboardConfig` read/write to cover `penalties` the same way `pointsByPriority` is handled today — `getPenalties()` / `setPenalties()` alongside the existing `getPointsByPriority()` / `setPointsByPriority()`, backed by the same singleton doc and same load-on-boot/refresh-on-write pattern.

**`backend/src/utils/points.js`**: `pointsForCompletedTask` reads the completed-late penalty via `getPenalties().completedLate` instead of the hardcoded `OVERDUE_PENALTY` import.

**`backend/src/utils/taskDates.js`**: `isTaskOverdue` changes its early-return from `task.status === "completed"` to `OVERDUE_EXEMPT_STATUSES.includes(task.status)`. This is the single shared function already used by `TaskDrawer.jsx`, `TaskTable.jsx`, `tasks/page.js`'s grouping, `dashboardController.js`'s overdue counts, and `aiController.js`'s AI insights — fixing it here covers all of them. The frontend's mirrored copy in `frontend/lib/taskDates.js` gets the identical change (plus its own local copy of `OVERDUE_EXEMPT_STATUSES`, since the frontend doesn't currently mirror `enums.constants.js` as a shared import).

**New: `backend/src/services/overdueSweep.js`**
- `applyOverduePenalties()`: `Task.find({ deadline: { $ne: null }, status: { $nin: OVERDUE_EXEMPT_STATUSES }, overduePenaltyApplied: false })`, then in application code filter to those whose `combineDeadlineAndTime`/`endOfDayLocal` cutoff is `< now` (same cutoff logic `isTaskOverdue` already uses). For each: set `overduePenaltyApplied = true` and save; `recordActivity({ action: "overdue_penalized", entityType: "task", entityId, project, meta: { title, points: -penalties.overdue, users: task.assignees.map(String) } })`; `notify` each assignee (reusing the `points_awarded` notification type with negative wording, e.g. `"-2 pts: '<title>' went overdue"`).
- `backend/src/server.js`: call `applyOverduePenalties()` once at boot (next to the existing `loadPointsConfig()` call) and then on a `setInterval` (every 2 minutes — frequent enough to feel "the moment it happens" without needing a real scheduler dependency).

**Bug creation penalty** (`taskController.js`'s `createTask`): after creating a task with `type === "bug"`, immediately `recordActivity({ action: "bug_logged", entityType: "task", entityId, project, meta: { title, points: -penalties.bug, users: task.assignees.map(String) } })` and notify each assignee. No penalty is applied retroactively if an existing task is later edited into a bug.

**Bug validation** (`createTask` and `updateTask`): when the resulting `type === "bug"`, require `modules.length >= 1` (400 "Bugs must be tagged to at least one module" otherwise). `type` and `reference` are added to `FULL_FIELDS` (manage-only edit, same tier as `priority`/`modules` today).

**`getLeaderboard` (`leaderboardController.js`)**: alongside the existing completed-task `Activity` scan, also fetch `Activity.find({ entityType: "task", action: { $in: ["overdue_penalized", "bug_logged"] }, createdAt: { $gte: weekStart, $lte: weekEnd } })` and apply each row's `meta.points` to each id in `meta.users` directly — not re-derived from the task's current assignees, so a later reassignment doesn't rewrite history. Final per-user point totals may go negative; left unclamped, since that's the intended accountability signal. `tasksCompleted` counts are unaffected by penalty rows.

**Time-in-status (`getTask`, `taskController.js`)**: new helper `computeStatusDurations(task, activities)` in `utils/points.js` (or a new small `utils/statusDurations.js`) — given the task's own `Activity` rows (`entityType: "task"`, `entityId: task._id`, `meta.statusFrom`/`meta.statusTo` present) ordered by `createdAt` ascending, walks segments starting at `task.createdAt` (initial status = first row's `statusFrom`, or the task's current status if no status-change activity exists yet), accumulating elapsed ms per status per transition, then a final open segment from the last transition to `now` if the task isn't in a terminal status. `getTask` fetches this task's activity rows (one extra indexed query, no new route) and attaches `statusDurations: { backlog, todo, ... }` (ms per status) and `totalWorkingMs` (`in_progress + review + testing`) to the response.

## Frontend

**Project detail page** (`app/(app)/projects/[id]/page.js`): `TABS` becomes `["overview", "modules", "bugs", "tasks", "timeline", "activity"]`. New `bugs` tab fetches `fetchTasks({ project: id, type: "bug" })` (extends the existing `listTasks` query-param whitelist with `type`) and renders the same card/table treatment as `tasks`, plus a "+ New bug" button.

**`Badge.jsx`**: `VALUE_TONES` gains `bug: "danger"` (red-tinted jira-style kind tag) and `client_review: "warning"` (same tone family as `review`/`testing` — pre-completion gate states).

**Status arrays**: `"client_review"` added to the three existing duplicated inline arrays — `TaskDrawer.jsx`'s `STATUSES`, `tasks/page.js`'s `STATUSES`, and `tasks/kanban/page.js`'s `COLUMNS` (as `["client_review", "Client review"]`) — in the same sequential position as the backend enum. This duplication already exists in the codebase (no shared frontend constants file for task statuses today); not introducing new debt, just keeping it consistent.

**`TaskDialog.jsx`**: gains a `forceType`/`lockProject` prop pair used when opened from the Bugs tab (project preselected and hidden, `type` defaulted to `"bug"`). When `type === "bug"`: the `modules` `MultiSelect` becomes required (yup `.min(1, "Bugs must be tagged to at least one module")`), and an optional `reference` text input appears.

**`TaskDrawer.jsx`**: shows the `bug`/`client_review` badges where relevant (next to priority, matching the existing overdue-badge pattern at line ~268), a read/edit `reference` field when `task.type === "bug"`, and a new "Time in status" section rendering `task.statusDurations` as human-readable durations (e.g. "2h 15m") plus "Total working time" from `task.totalWorkingMs`.

**Admin settings** (`app/(app)/admin/leaderboard/page.js`): the existing points form grows a second "Penalties" section (completed-late, overdue, bug — three number inputs) submitted through the same `updatePointsConfig` mutation, now sending `{ pointsByPriority: {...}, penalties: {...} }`. `leaderboardService.js`'s `fetchPointsConfig`/`updatePointsConfig` and the backend's `getPointsConfig`/`updatePointsConfig` controllers widen to the combined shape.

## Design decisions

- **Bug = Task + flag, not a new collection.** Reuses the entire existing pipeline (assignment, status flow, comments, activity log, points, kanban) for free; the Bugs tab is just a filtered view.
- **Overdue penalty is additive, not a replacement.** A task can eat both the new 2-pt "went overdue" penalty (once, live) and the existing 5-pt "completed late" penalty (once, at eventual completion) — they fire at different moments and answer different questions ("did it slip" vs "was it ever finished on time").
- **`client_review` exemption is current-status-only.** `isTaskOverdue` and the sweep both check the task's *live* status. A task that sits overdue in `client_review` and then moves to `in_progress` or `completed` while still past deadline re-enters normal overdue rules from that point — the 5-pt completed-late penalty is untouched by this change, since it depends only on `completedAt` vs the deadline cutoff, not status history. Confirmed acceptable; a fuller "forgive if it ever sat in client_review while overdue" would need a status-history flag and was explicitly deferred.
- **No new scheduler dependency.** The overdue sweep is a plain `setInterval`, matching this codebase's existing preference for lazy/simple computation over new infrastructure (no cron/agenda/bull anywhere in the repo today).
- **Penalty attribution is snapshotted at write time** (`meta.users` on the `Activity` row), not re-derived from the task's current assignees at leaderboard-read time — so reassigning a task later doesn't rewrite who ate a past penalty.

## Testing / verification plan

Extend backend smoke scripts (`backend/scripts/`) with assertions:

1. A task past its deadline+time, still incomplete, gets `overduePenaltyApplied` set and an `overdue_penalized` Activity within one sweep interval; the same task is never penalized twice.
2. A task in `client_review` past its deadline is skipped by the sweep and `isTaskOverdue` returns `false` for it; moving it to `in_progress` past deadline makes both go live again.
3. Creating a task with `type: "bug"` and no `modules` is rejected (400); with `modules` it succeeds and immediately produces a `bug_logged` Activity with the correct negative points for each assignee.
4. `getLeaderboard` correctly nets completed-task points against `overdue_penalized`/`bug_logged` penalty rows for the same user in the same week, including going negative.
5. `getTask`'s `statusDurations`/`totalWorkingMs` correctly reconstruct a fixture task's known sequence of status-change activities.
6. Admin `updatePointsConfig` persists and round-trips all three penalty values alongside `pointsByPriority`.

## Out of scope

- Manual start/stop timers (time-in-status is fully derived from the existing status-change activity log).
- Forgiving the completed-late penalty based on status history (see Design decisions).
- Any change to module CRUD, project visibility/scoping rules, or the modules-kanban board.
