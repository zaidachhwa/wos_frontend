# Assignment Model Overhaul — Design

**Status:** Approved, ready for planning
**Part of:** Productivity roadmap (1 of 4) — this sub-project is the foundation; three more follow separately:
2. Date-based task organization (Today/Yesterday bifurcation + past/upcoming visibility for members)
3. Generic boards for Projects & Modules
4. EOD Worklog overhaul + follow-up auto-populate

## Problem

Task and ProjectModule each currently have a single owner field (`assignee` / `lead`) plus a `collaborators[]` array that carries no real permissions or notification behavior — it's a display-only list. The team wants to assign a Task or Module to multiple people as equals: any of them can act on it, all of them see it and get notified, and there is no second-class "collaborator" role.

## Scope

Task and ProjectModule assignment only. Project-level `members[]` (already a list) is untouched. Module edit permissions (currently: any project-viewer can edit a module) are untouched — that's a separate, unrelated permission question.

## Data model

**`backend/src/models/Task.js`**
- Remove `assignee` (ObjectId) and `collaborators` (ObjectId[]).
- Add `assignees: [{ type: ObjectId, ref: "User" }]` (default `[]`).

**`backend/src/models/ProjectModule.js`**
- Remove `lead` (ObjectId) and `collaborators` (ObjectId[]).
- Add `assignees: [{ type: ObjectId, ref: "User" }]` (default `[]`).

Both arrays are unordered and carry no primary/secondary distinction — every entry has identical permissions.

**Migration script** — `backend/scripts/migrate-assignees.js`:
- For every Task: `assignees = dedupe([...(assignee ? [assignee] : []), ...collaborators])`, then unset `assignee`/`collaborators`.
- For every ProjectModule: same, using `lead` in place of `assignee`.
- Idempotent: skip documents that already lack the old fields (so re-running is safe).
- Assert-based check at the end: count of docs with old fields remaining == 0, count of `assignees` arrays matches expected merge count on a sample.
- Run manually via `node backend/scripts/migrate-assignees.js` before the feature branch merges (not wired into app startup).

## Backend behavior changes

**`taskController.js`**
- `FULL_FIELDS`: replace `"assignee", "collaborators"` with `"assignees"`.
- `isAssignee` → `isAssignee = task.assignees.some((a) => idOf(a) === String(req.user._id))`. Any assignee gets `ASSIGNEE_FIELDS` write access (status, actualHours, subtasks); manager/sublead+ keep full-field access as today.
- `createTask`/`updateTask`: accept `assignees` array from request body instead of `assignee`/`collaborators`.
- Notifications (`task_assigned`, `status_changed`, `comment_added`): fan out to every entry in `assignees` instead of the single `assignee`. On update, diff previous vs. new `assignees` and only notify newly-added members for `task_assigned` (avoid re-notifying people already on the task).
- `listTasks`: `?assignee=me` (query param name kept for API stability) filters `assignees: req.user._id` — Mongo matches array-contains natively, no query shape change needed.
- `.populate("assignee", ...)` / `.populate("collaborators", ...)` → single `.populate("assignees", "name role designation")`.

**`moduleController.js`**
- `createModule`/`updateModule`: `lead`/`collaborators` → `assignees` in the allowed-fields list and request body handling. No permission-model change (route-level `authorize("admin","manager","sublead")` + controller-level `canViewProject` stay as today).

**`projectController.js`** (shared visibility helpers used by task/module controllers too)
- `canViewProject`'s fallback `leadsAModule = ProjectModule.exists({ project: project._id, lead: user._id })` → `assignees: user._id`.
- `visibilityFilter`'s `ledProjectIds = ProjectModule.find({ lead: user._id }).distinct("project")` → `{ assignees: user._id }`.
- **Discovered during implementation:** the same fallback must also check `Task.exists({ project, assignees: user._id })` / `Task.find({ assignees: user._id }).distinct("project")`, not just `ProjectModule`. Without it, a person assigned only to a *task* (not a module) in a project they're not otherwise a member of couldn't view that project at all — which broke `GET /projects/:id`, `GET /tasks?assignee=me`, and task commenting for that person. Added alongside the module check.
- Net effect (intentional, follows directly from "visible to all assignees"): any task or module assignee — not just a manager-tier "lead" — now counts toward being able to view that project. This is the mechanism that makes a task or module "visible to all of its assigned members," per the request.

**Other readers of the old fields found during implementation** (not originally listed, but they query Task/ProjectModule directly and would have silently broken): `aiController.js` (daily planner, workload analysis, chat context — 6 call sites), `calendarController.js` (personal calendar + ICS feed), `notificationController.js` (due-soon reminders), `reportController.js` (team report + EOD work log — both queries and the "Tasks:"/"Modules:" line formatting, which now joins multiple assignee names with `, ` instead of showing one name). All updated to read `assignees` the same way as the controllers above.

**`dashboardController.js`**
- `memberDashboard`: `todayTasks` and `upcomingDeadlines` queries switch `assignee: user._id` → `assignees: user._id`.
- `managerLikeDashboard`: `taskFilter`'s `assignee: { $in: reportIds }` → `assignees: { $in: reportIds }`; `workload` calc's `String(t.assignee) === String(r._id)` → `t.assignees.some((a) => String(a) === String(r._id))`.

## Frontend changes

- **`TaskDialog.jsx`**: remove the separate "Assignee" single-select and "Collaborators" multi-select; replace with one "Assignees" multi-select (reuses the existing `<select multiple>` pattern already used for collaborators — no new UI component). Default value becomes `[]` instead of `assignee: ""`.
- **`ModuleDialog.jsx`**: same collapse — "Lead" + "Collaborators" → single "Assignees" multi-select. Drop the current `leadOptions` filter (today's "Lead" select only offers admin/manager/sublead directory entries) — the unified "Assignees" select offers the full directory, same as Task's, since assignees are no longer role-restricted.
- **`TaskDrawer.jsx`, `TaskTable.jsx`, `KanbanCard.jsx`, `TaskMiniList.jsx`, `tasks/page.js`, `projects/[id]/page.js`**: anywhere currently rendering "assignee avatar + collaborator list" separately, render one avatar-list from `assignees`.
- No change to routing, filters UI, or the kanban column structure.

## Error handling

- `assignees` containing an invalid/non-existent user ID: rely on Mongoose ref validation at save time (existing behavior for `assignee` today — no stricter validation added, matches current codebase conventions of not over-validating internal-only inputs).
- Empty `assignees: []` is valid (unassigned task/module), same as today's `assignee: null`.

## Testing

- Extend backend smoke scripts (`backend/scripts/smoke-tasks.js`-equivalent, whichever currently covers Task CRUD) with: multi-assignee create, one non-owner assignee updating status (should succeed), a non-assignee non-manager updating status (should still 403), notification fan-out to 2+ assignees.
- Run `migrate-assignees.js` against a seeded dataset with existing `assignee`+`collaborators` docs and assert the merge is correct and idempotent.
- Manual browser check: create a task, assign 2 members, confirm both see it on their dashboard "today" widget and task list, confirm both can change its status, confirm a 3rd project member (not assigned) cannot.
- Full existing smoke suite (`npm run smoke`) must stay green — this touches shared controllers (dashboard, tasks, modules) used by many other features.
