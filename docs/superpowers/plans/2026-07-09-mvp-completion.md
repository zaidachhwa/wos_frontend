# WorkOS MVP Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. One implementer subagent per task, review after each, whole-branch review at the end.
>
> **Plan style note:** unlike the foundation plan, tasks here specify *binding interfaces* (schemas, endpoints, role rules, file paths, component contracts — see the spec) rather than verbatim code. Implementers write the code; the spec section named in each task is the contract. Compensating controls: capable implementer models, per-task reviews, smoke-script gates.

**Goal:** Complete the WorkOS MVP: org management, projects→modules→tasks, kanban, time board, calendar, follow-ups, notifications, activity, role dashboards, settings, and Gemini AI features — end to end against the existing foundation.

**Spec (binding):** `frontend/docs/superpowers/specs/2026-07-09-mvp-completion-design.md`

## Global Constraints

All foundation-plan Global Constraints still apply (JS only, envelope `{success,message,data?}`, tokens-only styling, axios only, RHF+Yup, conventional commits, single wos repo, no test framework — smoke scripts).
Additional:
- New backend deps: none (Gemini via axios). New frontend deps: `@tanstack/react-query`, `@hello-pangea/dnd`, `@fullcalendar/react` `@fullcalendar/daygrid` `@fullcalendar/timegrid` `@fullcalendar/list` `@fullcalendar/interaction` — nothing else.
- Every write endpoint validates input (validators/ pattern from Task 6 of foundation).
- Every backend task extends the smoke suite and leaves `npm run smoke` green; every frontend task leaves `npm run build` + `npm run lint` green.
- Statuses/priorities/categories: exact enum strings from the spec. Roles: admin|manager|sublead|member.
- FullCalendar CSS import exception: FullCalendar injects its own styles; theme overrides only via CSS variables in globals.css (still no raw hex outside globals.css).

---

### Task B1: Models + shared record/notify utils
Create the seven models and `utils/record.js` exactly per spec §"New models"/"Shared utils". Modify nothing else. Verify: import-check like foundation Task 2. Commit `feat: add mvp data models and activity/notification utils`.

### Task B2: Org endpoints (departments, teams, directory) + smoke-org
`controllers/orgController.js`, `routes/orgRoutes.js` (mounted `/api/departments`, `/api/teams`), `GET /api/users/directory` added to userRoutes (all roles), validators. Role rules per spec. `scripts/smoke-org.js`: admin CRUDs dept+team, member can list but not create (403), directory hides email? (directory returns id/name/role/designation/department/team — assert no email/password). Wire into `npm run smoke`. Commit `feat: add department, team and directory endpoints`.

### Task B3: Projects + modules endpoints + smoke
`projectController.js`/`moduleController.js`, routes `/api/projects`, `/api/projects/:projectId/modules`. Visibility + role rules and computed progress per spec. recordActivity on create/update; notify members on project create/assignment. `scripts/smoke-projects.js` part 1: manager creates project w/ member; member sees it in list, outsider member does not; module create; PATCH rules (member 403). Commit `feat: add project and module endpoints`.

### Task B4: Tasks + comments + kanban transitions + smoke
`taskController.js`, `/api/tasks` routes per spec: filters, role-scoped PATCH (assignee: status/actualHours/subtasks only), comments endpoint. notify on assign/status change/comment; recordActivity all writes. Extend `smoke-projects.js` (or `smoke-tasks.js`): create task→assign→member updates status backlog→in_progress→completed, member forbidden to reassign (403), comment triggers notification for assignee, project progress reflects completion. Commit `feat: add task endpoints with comments and kanban transitions`.

### Task B5: Follow-ups endpoints + smoke-followups
Per spec: upsert own draft/submit, unique (user,date,type), team listing for manager+ (reports = users whose reportingManager is caller; admin sees all), review endpoint. Lock: PATCHing a reviewed follow-up → 409. notify manager on submit; notify user on review. Smoke: member submits morning; manager lists team pending, reviews with comment; member sees reviewed status; double-submit same day upserts not duplicates. Commit `feat: add morning and evening follow-up endpoints`.

### Task B6: Time blocks + calendar aggregate + smoke
`/api/timeblocks` CRUD + manager-for-report rule; `/api/calendar` aggregate per spec item shape. Overlap is allowed (no constraint). Validate end > start. Smoke: member creates block; manager creates block for report (member sees it); member cannot create for someone else (403); calendar range returns block + a task deadline. Commit `feat: add time blocks and calendar aggregate`.

### Task B7: Notifications + activity endpoints + smoke
Per spec incl. lazy reminders (followup_reminder time-gated; deadline_reminder deduped per day via existing-notification check). `/api/activity` project feed + own feed. Smoke: unreadCount increments on task assign, mark-read, mark-all-read; project activity lists task events. Commit `feat: add notifications and activity endpoints`.

### Task B8: Dashboard + profile endpoints + smoke
`/api/dashboard` role-shaped payloads exactly per spec (one controller, switch on role; sublead = manager shape scoped to led modules/projects + own tasks). `/api/profile` PATCH + password change. Smoke: admin/manager/member payload shape assertions (keys present, workload rows for manager), password change then login with new password. Commit `feat: add role dashboards and profile endpoints`.

### Task B9: Gemini AI endpoints + smoke-ai
`services/gemini.js` (axios, generateText/generateJson, 503 pathway), `aiController.js`, `/api/ai/*` per spec. Prompts assemble compact context server-side; never send password/refreshToken fields. generateJson: strip ```json fences before parse; on parse failure → 502 "AI returned an unreadable response". smoke-ai: without key assert 503 envelope on all four; with key assert daily-planner returns non-empty string and project-health returns healthScore number 0-100. Commit `feat: add gemini ai endpoints`.

### Task F1: Frontend plumbing — TanStack Query, services, UI kit
Install the five frontend deps. `app/providers.jsx` (QueryClientProvider, staleTime 30_000, refetchOnWindowFocus false) wrapped in root layout. Service files per API area (`orgService`, `projectService`, `taskService`, `followupService`, `timeblockService`, `calendarService`, `notificationService`, `dashboardService`, `profileService`, `aiService`) — thin axios wrappers returning `data.data`. `components/ui/`: Dialog, Drawer, Badge, Table, EmptyState, Skeleton, Field wrappers per spec §Plumbing (contracts: Dialog {open,onClose,title,children,footer?}; Drawer {open,onClose,title,children}; Badge {variant:status|priority,value}). Verify build+lint. Commit `feat: add query provider, api services and ui kit`.

### Task F2: Team page
Per spec §Pages `/team`. Admin: users table + create/edit dialog (uses existing admin endpoints + directory), departments/teams tab. Manager: directory + reports. Others: directory only. Empty states + skeletons. Commit `feat: add team management page`.

### Task F3: Projects list + project details
`/projects` and `/projects/[id]` per spec (tabs Overview/Modules/Tasks/Activity; progress bars; create/edit dialogs manager+). Task table in Tasks tab reuses the drawer from F4 — build pages now with a placeholder "open drawer" wire point, integrate in F4 if sequencing requires. Commit `feat: add projects pages`.

### Task F4: Tasks page + task drawer
`/tasks` + shared `components/tasks/TaskDrawer.jsx` per spec (role-aware editors, subtasks, comments). Wire drawer into project details Tasks tab too. Commit `feat: add tasks page and task drawer`.

### Task F5: Kanban board
`/kanban` per spec with @hello-pangea/dnd; optimistic status PATCH with rollback on error (TanStack mutation). Commit `feat: add kanban board`.

### Task F6: Calendar page
`/calendar` per spec with FullCalendar; timeblock create/edit dialog (RHF+Yup; manager report-picker via directory). Category → token color mapping via CSS vars. Commit `feat: add calendar page`.

### Task F7: Follow-ups page
Per spec: own Morning/Evening cards + manager Team tab with review dialog. Commit `feat: add follow-ups page`.

### Task F8: Notifications page + header bell
Per spec: grouped page, bell with unread badge + dropdown (poll via query refetchInterval 30_000), mark read/all. Commit `feat: add notifications ui`.

### Task F9: Role dashboards
Replace placeholder per spec §`/dashboard` — widgets per role wired to /api/dashboard, AI daily-plan card (calls aiService, renders markdown-ish plain text, handles 503 gracefully with "AI not configured"). Commit `feat: add role dashboard widgets`.

### Task F10: Settings + AI assistant drawer
`/settings` (profile + password forms). Header Sparkles button → chat drawer against /api/ai/chat (messages kept in local state; 503 → friendly notice). Manager dashboard workload-AI card + project-details health card (from spec AI section). Commit `feat: add settings page and ai assistant`.

### Task V1: End-to-end verification
Backend: `npm run smoke` full pass. Frontend: build + lint + hex grep. Browser demo path per spec success criterion 3 (scripted via curl where headless; visual bits listed for the user). Fix anything broken; commit fixes.

### Final: whole-branch review → fixes → present to user (no merge without their say).
