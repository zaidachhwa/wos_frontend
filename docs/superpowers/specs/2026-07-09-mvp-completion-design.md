# WorkOS MVP Completion — Design

Date: 2026-07-09
Status: Executing autonomously; user reviews the finished result.

## Scope

Everything in the PRD's MVP list not covered by the foundation slice:
org management (departments/teams/users UI), projects → modules → tasks →
subtasks, kanban, personal time board, unified calendar, morning/evening
follow-ups, notifications, activity timeline, role dashboards with real
widgets, profile settings, and the four AI features (Gemini).

## Deliberate simplifications (ponytail — recorded, not hidden)

- **No Redis / BullMQ / Socket.IO.** Notifications are Mongo documents;
  the frontend polls via TanStack Query (30s refetch). Ceiling: real-time
  push; upgrade path is Socket.IO later. Reminder-type notifications
  (follow-up nudges, deadline reminders) are generated lazily on read
  rather than by a scheduler.
- **Subtasks embedded** on Task (`[{ title, done }]`), **comments embedded**
  on Task (`[{ user, text, createdAt }]`). Separate collections only if
  they ever need their own queries.
- **Progress is computed, not stored**: module progress = completed/total
  tasks; project progress = mean of module progress (tasks without module
  count directly). Exposed by the API, never persisted.
- **AI needs `GEMINI_API_KEY`** in `backend/.env`. Absent key → every AI
  endpoint returns 503 `{ success: false, message: "AI is not configured" }`.
  Model: `gemini-2.0-flash` via REST (axios) — no SDK dependency.
- **Password reset stays deferred** (needs email). Profile settings =
  name/designation edit + change-password (old + new).

## Backend

### New models (`backend/src/models/`)

- `Project.js` — name*, description, manager (ref User)*, members [ref User],
  priority (low|medium|high|critical, default medium), startDate, deadline,
  status (planning|active|on_hold|completed|cancelled, default planning),
  timestamps.
- `ProjectModule.js` (mongoose model name "ProjectModule"; "Module" collides
  with Node) — project (ref)*, name*, description, deadline, lead (ref User),
  status (planning|active|on_hold|completed|cancelled, default planning).
- `Task.js` — project (ref)*, module (ref ProjectModule, nullable), title*,
  description, assignee (ref User), priority (low|medium|high|critical,
  default medium), status (backlog|todo|in_progress|review|testing|
  completed|blocked, default backlog), estimatedHours, actualHours,
  deadline, labels [String], subtasks [{title, done}], comments
  [{user ref, text, createdAt}], timestamps.
- `FollowUp.js` — user (ref)*, date ("YYYY-MM-DD" string)*, type
  (morning|evening)*, status (draft|submitted|reviewed, default draft),
  morning: {yesterdayCompleted, todayPlan, blockers, estimatedHours},
  evening: {completedWork, remainingWork, tomorrowPlan, actualHours,
  challenges}, managerComment, reviewedBy (ref User), submittedAt.
  Unique index (user, date, type).
- `TimeBlock.js` — user (ref)*, title*, start (Date)*, end (Date)*,
  description, category (meeting|deep_work|personal|followup|project_work|
  break)*, color, project (ref, nullable), createdBy (ref User — manager
  assignment support).
- `Notification.js` — user (ref)*, type (task_assigned|task_updated|
  comment_added|status_changed|deadline_reminder|followup_reminder|
  project_updated)*, title*, body, link, read (default false), timestamps.
- `Activity.js` — actor (ref User)*, action (String)*, entityType
  (project|module|task|followup|timeblock|user)*, entityId*, project
  (ref, nullable — for project activity feeds), meta (Mixed), timestamps.

### Shared utils

- `utils/record.js` — `recordActivity({actor, action, entityType, entityId,
  project?, meta?})` and `notify({user, type, title, body?, link?})`;
  both fire-and-forget (`.catch(console.error)`), never blocking the response.

### Routes (all behind `authenticate`; envelope everywhere)

Role rules follow the PRD permissions matrix; "manager+" = admin|manager,
"sublead+" = admin|manager|sublead.

- `/api/departments`, `/api/teams` — CRUD, admin only. GET list open to all
  authenticated (needed for pickers).
- `/api/users` — existing admin CRUD stays; add `GET /api/users/directory`
  (all roles): id/name/role/designation/department/team only.
- `/api/projects` — POST manager+; GET list (admin/manager: all; sublead/
  member: where member or manager or module-lead); GET :id (with computed
  progress, modules+tasks summary); PATCH manager+ (or project.manager);
  DELETE admin.
- `/api/projects/:projectId/modules` — POST/PATCH sublead+ AND the actor
  must be able to view the project (admin/manager always can; a sublead
  only if member/manager/module-lead of it); GET with tasks count + progress.
- `/api/tasks` — POST sublead+ with the same project-viewer requirement; GET list with filters (project, module,
  assignee, status, priority, search, dueBefore); GET :id; PATCH — assignee
  may update only status/actualHours/subtasks; sublead+ may update all;
  status changes + assignments trigger notify + recordActivity.
  `POST /api/tasks/:id/comments` (any project member) → notify assignee.
- `/api/followups` — `POST /api/followups` upsert own (user,date,type) while
  draft|submitted; submit sets status=submitted+submittedAt. GET
  `/api/followups?date=&type=&scope=team` — manager+/sublead see their
  reports' (reportingManager = self) submissions; `PATCH /api/followups/:id/review`
  (manager+) sets reviewed + managerComment.
- `/api/timeblocks` — CRUD own; manager+ may create for a report
  (user field ≠ self allowed then). GET `?from=&to=&user=`.
- `/api/calendar?from=&to=` — aggregate for current user: timeblocks,
  task deadlines (assigned), project deadlines (member/manager), submitted
  follow-up markers. Each item: {id, type, title, start, end?, color?, link}.
- `/api/notifications` — GET own (latest 50, unreadCount), PATCH :id/read,
  POST mark-all-read. Lazy reminders: GET first injects (a) followup_reminder
  if today's morning/evening follow-up not submitted (morning before 12:00,
  evening after 17:00 local), (b) deadline_reminder for own tasks due within
  24h (deduped by a per-day check).
- `/api/activity?project=&limit=` — project feed (project members) or own
  recent activity.
- `/api/dashboard` — one endpoint, role-shaped payload:
  - admin: totals (projects by status, active users, managers), team sizes,
    recent activity.
  - manager: today's schedule (timeblocks), pending morning/evening
    follow-ups from reports, overdue+upcoming (7d) deadlines, blocked tasks
    with assignees, delayed projects (deadline < now, not completed),
    workload (per report: open tasks, est hours), recent activity.
  - sublead: same shape as manager scoped to led modules/projects + own tasks.
  - member: today's tasks (due/in progress), upcoming deadlines, today's
    schedule, follow-up status (morning/evening submitted?), assigned
    projects, recent own activity.
- `/api/profile` — PATCH name/designation; `POST /api/profile/password`
  (verify old, bcrypt new).
- `/api/ai/*` (all roles unless noted; 503 without key):
  - `POST /api/ai/daily-planner` — gathers user's day (tasks, deadlines,
    timeblocks, pending follow-ups) → Gemini → markdown plan.
  - `POST /api/ai/workload` (manager+) — reports' task/hour aggregates →
    suggestions (overloaded/underutilized/reassignment).
  - `POST /api/ai/project-health` body {projectId} (member of project) —
    deadline proximity, status mix, blocked count → {healthScore 0-100,
    riskLevel low|medium|high, recommendations[]} parsed from JSON response.
  - `POST /api/ai/chat` body {message} — server gathers compact org context
    scoped to the caller's role (their projects, tasks, team follow-ups for
    managers) and answers questions like "who is blocked?".
  - Shared `services/gemini.js` — `generateText(prompt)` /
    `generateJson(prompt)` via axios to
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`.

### Smoke scripts

One per area, wired into `npm run smoke`: smoke-org, smoke-projects
(projects→modules→tasks→comments→kanban transitions→progress), smoke-followups,
smoke-timeblocks-calendar, smoke-notifications-dashboard, smoke-profile.
AI: smoke-ai runs only if GEMINI_API_KEY set; otherwise asserts the 503.

## Frontend

New deps: `@tanstack/react-query`, `@hello-pangea/dnd` (kanban),
`@fullcalendar/react` + daygrid/timegrid/list/interaction (calendar).
Everything else stays within existing stack rules (axios, Zustand, RHF+Yup,
lucide, tokens only).

### Plumbing

- `app/providers.jsx` — QueryClientProvider (staleTime 30s); wrap in root
  layout. `services/` gains one file per API area mirroring backend routes.
- Reusable UI in `components/ui/`: `Dialog` (focus trap, ESC, max-w-720px,
  rounded-dialog), `Drawer` (right slide-in), `Badge` (status/priority
  variants), `Table` shell (sticky header, hover), `EmptyState`
  (heading/description/action), `Skeleton`, `Select`/`Input`/`Textarea`
  field wrappers for RHF. All tokens, 150–250ms transitions.

### Pages (all inside `app/(app)/`, shell exists)

- `/team` — users table (search/filter by role/department), create/edit user
  dialog (admin), departments & teams management tab (admin), profile drawer
  (workload snapshot). Managers see read-only directory + their reports.
- `/projects` — card/list of projects (status, priority, progress bar,
  deadline, manager); create/edit dialog (manager+); empty state.
- `/projects/[id]` — header (status, progress, members, deadline), tabs:
  Overview (description, members, recent activity), Modules (list + create
  dialog + per-module progress), Tasks (table with filters), Activity.
- `/tasks` — "My tasks" table with filters + task drawer: description,
  meta editors (status/priority/assignee per role), subtask checklist,
  comments thread, activity. Drawer reused from project tasks tab.
- `/kanban` — board across own visible tasks, filter by project; columns
  per PRD statuses; @hello-pangea/dnd drag between columns → PATCH status;
  card: title, priority badge, deadline, assignee avatar-initials, labels,
  est hours.
- `/calendar` — FullCalendar (day/week/month/list views) fed by
  /api/calendar; category colors from tokens; click timeblock → edit dialog;
  "New time block" button; managers can pick a report as owner.
- `/follow-ups` — two cards (Morning, Evening): status chip
  (draft/submitted/reviewed), RHF form per type, submit → locked when
  reviewed. Manager tab "Team": date picker, list of reports' submissions,
  review dialog (comment + mark reviewed), pending highlighted.
- `/notifications` — grouped Today/Yesterday/Older, unread dot, mark all
  read; header bell shows unreadCount badge (polled), dropdown of latest 5.
- `/dashboard` — replaces placeholder with role widgets (all data from
  /api/dashboard): stat tiles + lists per role as specced above; each widget
  links into its module; AI "Daily plan" card with generate button.
- `/settings` — profile form (name/designation), change password form.
- AI assistant: floating panel button in header (Sparkles icon) opening a
  right drawer chat against /api/ai/chat; workload & project-health cards
  on manager dashboard / project details.

### Sidebar

Existing nav routes all become real. Notifications item shows unread badge.

## Out of scope (unchanged from PRD non-goals)

Email delivery, mobile, real-time sockets, file attachments (Task
`attachments` omitted for MVP — needs storage), global Ctrl+K search,
dark-mode toggle, reorderable dashboard cards, Gantt/timeline view.

## Success criteria

1. `npm run smoke` (backend, all scripts) passes.
2. Frontend `npm run build` + lint clean; every sidebar route renders real
   data against the live backend (no 404 nav items).
3. Full demo path works in browser: admin creates dept/team/users → manager
   creates project/modules/tasks → member sees tasks on kanban, drags to
   in-progress, submits morning follow-up → manager reviews it, sees
   workload + dashboards → notifications reflect the above → calendar shows
   deadlines/timeblocks → AI endpoints respond (real answers with key,
   clean 503 without).
4. Design tokens only; no raw hex outside globals.css.
