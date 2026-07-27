# Calendar: multi-day task spans, labels, completed marking

Date: 2026-07-27

## Problem

The calendar board (`frontend/app/(app)/calendar/page.js`, FullCalendar `timeGridWeek`) shows a task deadline as a single point-in-time event on its deadline day. For a task created today with a deadline several days out, the user wants the task to appear as one continuous bar across every day from today through the deadline (matching the reference EWC schedule image), tagged with an identifying label, and visibly marked as done if completed before its deadline.

## Scope

Calendar rendering + the backend calendar feed only. No changes to the `Task` model — all fields needed (`deadline`, `labels`, `status`, `project`, `createdAt`) already exist.

## Design

### Backend: `backend/src/controllers/calendarController.js`

`collectItems` currently queries `Task.find({ assignees: userId, deadline: range })` and pushes only `{ id, type, title, start: deadline, startTime, endTime, link }` — no span end, no label, no status.

Changes:
1. **Query**: switch from "deadline falls inside the visible range" to "task's active span overlaps the visible range": `Task.find({ assignees: userId, deadline: { $gte: range.from }, createdAt: { $lte: range.to } })`. This is the reason a query change is required at all — a task created today with a deadline two weeks out must still appear on this week's board even though its deadline isn't in this week.
2. **Payload**: add `end: t.deadline`, `spanStart: t.createdAt`, `label: t.labels?.[0] || null`, `status: t.status`, and populate `project` (`.populate("project", "name")`) to include `projectName: t.project?.name`.

### Frontend: `frontend/app/(app)/calendar/page.js`

For each `task_deadline` item where the span covers more than one calendar day (`spanStart`'s date < `deadline`'s date):
- Build a FullCalendar `allDay: true` event with `start = max(spanStart, today)` and `end = deadline + 1 day` (FullCalendar's `end` is exclusive) — this is FullCalendar's native multi-day event support, rendered as one continuous bar across the day columns in the all-day row of `timeGridWeek`, so no custom grid layout code is needed.
- Single-day tasks (span ≤ 1 day) keep today's existing behavior (a normal point event, using `startTime`/`endTime` via `combineDeadlineAndTime` as today).

**Label + color**: render `projectName` (falling back to `label`) as a small pill via FullCalendar's `eventContent` render hook. Background color is derived per-project (a small deterministic hash of `project` id into an existing calendar color token, same pattern as `eventColor`), so each project reads as a consistent color across the board.

**Completed marking**: if `status === "completed"`, apply a "done" style to the bar — dim the background, prefix a checkmark, strike through the title. Computed client-side from `status`, no separate boolean.

**Click behavior**: unchanged — FullCalendar already fires one `eventClick` for the whole bar regardless of which day-segment was clicked, since it's a single event object; this opens the task (existing `router.push(item.link)` path).

## Out of scope / explicitly deferred

- No new "completed" panel/section — completed tasks stay in place on the grid, just restyled (per your answer).
- No change to `dayGridMonth`/`listWeek`/`timeGridDay` views beyond what FullCalendar does automatically for multi-day all-day events in those views.
- Timeblocks (separate model) are unaffected — this only touches `task_deadline` items.
