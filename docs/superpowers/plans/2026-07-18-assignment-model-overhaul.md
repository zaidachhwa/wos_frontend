# Assignment Model Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Task's `assignee`+`collaborators` and ProjectModule's `lead`+`collaborators` with a single equal-footing `assignees[]` array on each, so multi-person assignment works with full permissions/notifications/visibility for every assignee, and migrate existing data losslessly.

**Architecture:** Rename/merge the ownership fields at the schema level, then thread the new field name through every controller and helper that currently reads `assignee`/`collaborators`/`lead` (task CRUD, module CRUD, the shared project-visibility helpers, the dashboard queries, and the module-progress helper). A raw-driver migration script merges existing production data before/alongside the deploy. Frontend forms collapse two selects into one multi-select; frontend display components render one list instead of two.

**Tech Stack:** Backend: Express 5, Mongoose (ESM, Node 20). Frontend: Next.js 16 (JS), react-hook-form + yup, @tanstack/react-query. Testing: no framework — axios-driven assert scripts in `backend/scripts/smoke-*.js` run against a live dev server + seeded admin (`npm run smoke`, or individually via `node --env-file=.env scripts/smoke-projects.js`).

## Global Constraints

- No new dependencies. Reuse the existing native `<select multiple>` pattern already used for `collaborators` in `TaskDialog.jsx`/`ModuleDialog.jsx` — do not introduce a new multi-select UI component.
- Every assignee is fully equal — no primary/secondary distinction, anywhere (schema, permissions, notifications, UI).
- Module edit permissions are explicitly **out of scope** — leave the route-level `authorize("admin","manager","sublead")` gate on `POST/PATCH /projects/:projectId/modules*` untouched.
- `?assignee=me` query param name on `GET /tasks` stays as-is (API stability) even though it now matches against the `assignees` array.
- The full `npm run smoke` suite (in `backend/`) must stay green after every backend task.
- Follow existing code conventions exactly: no comments beyond what's already there, same error-handling shape (`{ success, message, data }`), same `idOf()` helper for ObjectId-vs-populated-doc comparisons.

---

### Task 1: Backend — unify the assignee model

**Files:**
- Modify: `backend/src/models/Task.js`
- Modify: `backend/src/models/ProjectModule.js`
- Modify: `backend/src/controllers/taskController.js`
- Modify: `backend/src/controllers/moduleController.js`
- Modify: `backend/src/controllers/projectController.js`
- Modify: `backend/src/controllers/dashboardController.js`
- Modify: `backend/src/utils/progress.js`
- Modify: `backend/scripts/smoke-projects.js`
- Modify (discovered during implementation — these also query `assignee`/`lead` on Task/ProjectModule directly and would silently break): `backend/src/controllers/aiController.js`, `backend/src/controllers/calendarController.js`, `backend/src/controllers/notificationController.js`, `backend/src/controllers/reportController.js`, `backend/scripts/smoke-timeblocks.js`, `backend/scripts/smoke-notifications.js`

**Interfaces:**
- Produces: `Task.assignees` (ObjectId[] ref User), `ProjectModule.assignees` (ObjectId[] ref User) — every later task (frontend, migration script) reads/writes these exact field names.
- Produces: `taskController.js` still exports `createTask, listTasks, getTask, updateTask, addComment` with unchanged signatures (route wiring untouched).
- Produces: `moduleController.js` still exports `listModules, createModule, updateModule` unchanged.
- Produces: `projectController.js` still exports `idOf, canViewProject, visibilityFilter` unchanged signatures, only their internal `lead` reference changes to `assignees`.

This is one atomic task because the model and every reader of the old field names must move together — splitting it would leave `npm run smoke` red for anyone reviewing an intermediate state.

- [ ] **Step 1: Update `Task.js` schema**

Replace lines 28-29:
```js
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
```
with:
```js
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
```

- [ ] **Step 2: Update `ProjectModule.js` schema**

Replace lines 12-13:
```js
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
```
with:
```js
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
```

- [ ] **Step 3: Update `projectController.js` visibility helpers**

Replace lines 16-22 (`canViewProject`):
```js
export const canViewProject = async (user, project) => {
  if (["admin", "manager"].includes(user.role)) return true;
  if (idOf(project.manager) === String(user._id)) return true;
  if ((project.members || []).some((m) => idOf(m) === String(user._id))) return true;
  const assignedToAModule = await ProjectModule.exists({ project: project._id, assignees: user._id });
  return !!assignedToAModule;
};
```

Replace lines 26-32 (`visibilityFilter`):
```js
export const visibilityFilter = async (user) => {
  if (["admin", "manager"].includes(user.role)) return {};
  const assignedProjectIds = await ProjectModule.find({ assignees: user._id }).distinct("project");
  return {
    $or: [{ members: user._id }, { manager: user._id }, { _id: { $in: assignedProjectIds } }],
  };
};
```

- [ ] **Step 4: Update `moduleController.js` create/update field handling**

In `createModule`, replace:
```js
    const { name, description, deadline, lead, collaborators, status } = req.body;
    const projectModule = await ProjectModule.create({
      project: project._id,
      name,
      description,
      deadline: deadline || null,
      lead: lead || null,
      collaborators: collaborators || [],
      status,
    });
```
with:
```js
    const { name, description, deadline, assignees, status } = req.body;
    const projectModule = await ProjectModule.create({
      project: project._id,
      name,
      description,
      deadline: deadline || null,
      assignees: assignees || [],
      status,
    });
```

In `updateModule`, replace:
```js
    const allowed = ["name", "description", "deadline", "lead", "collaborators", "status"];
```
with:
```js
    const allowed = ["name", "description", "deadline", "assignees", "status"];
```

- [ ] **Step 5: Update `utils/progress.js` populate call**

In `modulesWithProgress`, replace:
```js
    ProjectModule.find({ project: projectId })
      .populate("lead", "name role designation")
      .populate("collaborators", "name role designation")
      .sort("name")
      .lean(),
```
with:
```js
    ProjectModule.find({ project: projectId })
      .populate("assignees", "name role designation")
      .sort("name")
      .lean(),
```

- [ ] **Step 6: Update `taskController.js` — fields, permissions, notifications**

Replace the `FULL_FIELDS`/`ASSIGNEE_FIELDS` block (lines 10-22):
```js
const FULL_FIELDS = [
  "title",
  "description",
  "module",
  "assignees",
  "priority",
  "status",
  "estimatedHours",
  "actualHours",
  "deadline",
  "labels",
  "subtasks",
];
const ASSIGNEE_FIELDS = ["status", "actualHours", "subtasks"];
```

In `createTask`, replace the destructure + create call:
```js
    const {
      project: projectId,
      module: moduleId,
      title,
      description,
      assignees,
      priority,
      status,
      estimatedHours,
      deadline,
      labels,
    } = req.body;
```
```js
    const task = await Task.create({
      project: project._id,
      module: moduleId || null,
      title,
      description,
      assignees: assignees || [],
      priority,
      status,
      estimatedHours,
      deadline: deadline || null,
      labels: labels || [],
    });
```

Replace the post-create notify block:
```js
    for (const userId of task.assignees) {
      notify({
        user: userId,
        type: "task_assigned",
        title: `Assigned to task "${task.title}"`,
        link: `/tasks/${task._id}`,
      });
    }
```

In `listTasks`, replace:
```js
    if (assignee) filter.assignee = assignee === "me" ? req.user._id : assignee;
```
with:
```js
    if (assignee) filter.assignees = assignee === "me" ? req.user._id : assignee;
```
and replace the populate/query chain:
```js
    const tasks = await Task.find(filter)
      .populate("assignees", "name role designation")
      .sort("-createdAt")
      .lean();
```

In `getTask`, replace:
```js
    const task = await Task.findById(req.params.id)
      .populate("assignees", "name role designation")
      .populate("comments.user", "name role designation");
```

In `updateTask`, replace the permission check:
```js
    const canManageFully = SUBLEAD_PLUS.includes(req.user.role) && (await canViewProject(req.user, project));
    const isAssignee = task.assignees.some((a) => idOf(a) === String(req.user._id));
    if (!canManageFully && !isAssignee) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
```

Replace the assignee-diffing + save + notify section:
```js
    const prevAssignees = task.assignees.map((a) => String(a));
    const prevStatus = task.status;

    for (const key of allowedFields) {
      if (key in req.body) task[key] = req.body[key];
    }
    await task.save();

    recordActivity({
      actor: req.user._id,
      action: "updated",
      entityType: "task",
      entityId: task._id,
      project: task.project,
    });

    const newlyAssigned = task.assignees.map((a) => String(a)).filter((id) => !prevAssignees.includes(id));
    for (const userId of newlyAssigned) {
      notify({
        user: userId,
        type: "task_assigned",
        title: `Assigned to task "${task.title}"`,
        link: `/tasks/${task._id}`,
      });
    }
    if (task.status !== prevStatus) {
      for (const userId of task.assignees) {
        notify({
          user: userId,
          type: "status_changed",
          title: `Task "${task.title}" is now ${task.status}`,
          link: `/tasks/${task._id}`,
        });
      }
    }
```

In `addComment`, replace the notify-the-assignee tail:
```js
    for (const userId of task.assignees) {
      if (idOf(userId) !== String(req.user._id)) {
        notify({
          user: userId,
          type: "comment_added",
          title: `New comment on "${task.title}"`,
          link: `/tasks/${task._id}`,
        });
      }
    }
```

- [ ] **Step 7: Update `dashboardController.js` queries**

In `managerLikeDashboard`, replace:
```js
  const taskFilter = { $or: [{ project: { $in: projectIds } }, { assignee: { $in: reportIds } }] };
```
with:
```js
  const taskFilter = { $or: [{ project: { $in: projectIds } }, { assignees: { $in: reportIds } }] };
```
and replace:
```js
    Task.find({ assignee: { $in: reportIds }, status: { $ne: "completed" } }).select(
      "assignee estimatedHours"
    ),
```
with:
```js
    Task.find({ assignees: { $in: reportIds }, status: { $ne: "completed" } }).select(
      "assignees estimatedHours"
    ),
```
and replace the workload calc:
```js
  const workload = reports.map((r) => {
    const openTasks = reportOpenTasks.filter((t) => t.assignees.some((a) => String(a) === String(r._id)));
```
Also replace every `.populate("assignee", "name role designation")` in this function with `.populate("assignees", "name role designation")` (3 occurrences: `overdueTasks`, `upcomingDeadlines`, `blockedTasks`).

In `memberDashboard`, replace:
```js
      Task.find({
        assignees: user._id,
        status: { $ne: "completed" },
        $or: [{ deadline: { $gte: start, $lte: end } }, { status: "in_progress" }],
      }).populate("assignees", "name role designation"),
      Task.find({ assignees: user._id, deadline: { $gte: now, $lte: in7d }, status: { $ne: "completed" } }).sort(
        "deadline"
      ),
```

- [ ] **Step 8: Update `smoke-projects.js` assertions**

Replace the module-create call (line 96) — no change needed, it doesn't set lead/collaborators today.

Replace the task-create call (line 202-207):
```js
  const taskCreated = await axios.post(
    `${BASE}/tasks`,
    { project: projectId, module: moduleId, title: "Build API", assignees: [member.userId, outsiderSublead.userId] },
    manager.auth
  );
  assert.equal(taskCreated.status, 201, "manager creates a task assigned to two people");
  assert.equal(taskCreated.data.data.task.status, "backlog", "new task starts in backlog");
  assert.equal(taskCreated.data.data.task.assignees.length, 2, "both assignees stored");
  const taskId = taskCreated.data.data.task._id;
```

(`outsiderSublead` is already a project-outsider per the earlier setup, but being assigned to the task should still let them act as assignee — that's the "visible to all assignees" behavior we're verifying. No visibility-check assertions rely on `outsiderSublead` being an outsider later in the file, so this reuse is safe — confirmed by reading the rest of the file.)

Replace:
```js
  const memberTaskList = await axios.get(`${BASE}/tasks?assignee=me`, member.auth);
  assert.ok(
    memberTaskList.data.data.tasks.some((t) => t._id === taskId),
    "assignee=me lists a task the member is one of several assignees on"
  );

  const secondAssigneeTaskList = await axios.get(`${BASE}/tasks?assignee=me`, outsiderSublead.auth);
  assert.ok(
    secondAssigneeTaskList.data.data.tasks.some((t) => t._id === taskId),
    "assignee=me also lists the task for the second assignee"
  );
```

Replace the reassign-forbidden body:
```js
  const memberReassignForbidden = await axios.patch(
    `${BASE}/tasks/${taskId}`,
    { assignees: [outsider.userId] },
    { ...member.auth, validateStatus: () => true }
  );
  assert.equal(memberReassignForbidden.status, 403, "plain assignee cannot reassign the task");
```

Add, right after the existing `toCompleted` assertion (which stays as-is since `outsiderSublead` isn't touched by it — but note `toInProgress`/`toCompleted` are driven by `member.auth`, which is still a valid assignee, so no change needed there):
```js
  const secondAssigneeCanEditStatus = await axios.patch(
    `${BASE}/tasks/${taskId}`,
    { status: "in_progress" },
    outsiderSublead.auth
  );
  assert.equal(secondAssigneeCanEditStatus.status, 200, "the second assignee can also move the task's status");
```
Place this new assertion immediately before the existing `toCompleted` block (so the task is still `in_progress` when `toCompleted` runs as `member.auth`).

- [ ] **Step 9: Run the full smoke suite**

Prereqs: `wos_mongodb` docker container running, backend dev server running (`npm run dev` in `backend/`), `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` read fresh from `backend/.env`.

Run: `cd backend && npm run smoke`
Expected: all 9 smoke scripts print their assertions passing with no thrown `AssertionError`, process exits 0.

- [ ] **Step 10: Commit**

```bash
git add backend/src/models/Task.js backend/src/models/ProjectModule.js \
  backend/src/controllers/taskController.js backend/src/controllers/moduleController.js \
  backend/src/controllers/projectController.js backend/src/controllers/dashboardController.js \
  backend/src/utils/progress.js backend/scripts/smoke-projects.js \
  backend/src/controllers/aiController.js backend/src/controllers/calendarController.js \
  backend/src/controllers/notificationController.js backend/src/controllers/reportController.js \
  backend/scripts/smoke-timeblocks.js backend/scripts/smoke-notifications.js
git commit -m "feat: unify Task/ProjectModule assignee+collaborators into a single assignees[] array"
```

**Implementation notes (found while executing this task):**
- `projectController.js`'s `canViewProject`/`visibilityFilter` needed a Task-assignee check added alongside the ProjectModule-assignee check (Step 3 as originally written only covered modules) — otherwise someone assigned only to a task, not a module, in a project they're not a member of couldn't view that project, breaking `GET /projects/:id`, `GET /tasks?assignee=me`, and comment notifications for them.
- Four more controllers read the old `assignee`/`lead` fields directly and needed the same rename: `aiController.js`, `calendarController.js`, `notificationController.js`, `reportController.js` (the latter is also the EOD-worklog code — its "Tasks:"/"Modules:" lines now join multiple assignee names with `, ` instead of one name).
- Two more smoke scripts (not just `smoke-projects.js`) created tasks with the old `assignee:` key: `smoke-timeblocks.js`, `smoke-notifications.js`.
- The dev server runs with `node --watch`; a stale watch process didn't pick up a new import (`Task` in `projectController.js`) until fully restarted — worth a manual restart if a change that touches imports doesn't seem to take effect.
- `MONGODB_URI` (not `MONGO_URI`) is the actual env var name (`backend/src/db/connect.js:7`) — matters for Task 2's migration script.

---

### Task 2: Backend — data migration script

**Files:**
- Create: `backend/scripts/migrate-assignees.js`

**Interfaces:**
- Consumes: raw MongoDB collections `tasks` and `projectmodules` (Mongoose's default pluralized, lowercased collection names for `Task`/`ProjectModule`) — accessed via `mongoose.connection.db.collection(...)`, NOT via the `Task`/`ProjectModule` models, so this script works correctly whether run before or after Task 1's schema deploy (a strict Mongoose schema hides fields it doesn't declare).
- Produces: no exports — a standalone one-shot script, run via `node --env-file=.env scripts/migrate-assignees.js`, matching the existing `seed.js` invocation convention.

- [ ] **Step 1: Write the script**

```js
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

const migrateCollection = async (db, collectionName, primaryField) => {
  const coll = db.collection(collectionName);
  const cursor = coll.find({
    $or: [{ [primaryField]: { $exists: true } }, { collaborators: { $exists: true } }],
  });

  let migrated = 0;
  for await (const doc of cursor) {
    const merged = [
      ...(doc[primaryField] ? [String(doc[primaryField])] : []),
      ...((doc.collaborators || []).map(String)),
    ];
    const assignees = [...new Set(merged)].map((id) => new mongoose.Types.ObjectId(id));

    await coll.updateOne(
      { _id: doc._id },
      { $set: { assignees }, $unset: { [primaryField]: "", collaborators: "" } }
    );
    migrated += 1;
  }
  return migrated;
};

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const taskCount = await migrateCollection(db, "tasks", "assignee");
  const moduleCount = await migrateCollection(db, "projectmodules", "lead");

  console.log(`Migrated ${taskCount} tasks, ${moduleCount} modules.`);

  const remainingTasks = await db
    .collection("tasks")
    .countDocuments({ $or: [{ assignee: { $exists: true } }, { collaborators: { $exists: true } }] });
  const remainingModules = await db
    .collection("projectmodules")
    .countDocuments({ $or: [{ lead: { $exists: true } }, { collaborators: { $exists: true } }] });

  console.assert(remainingTasks === 0, `FAIL: ${remainingTasks} tasks still have old fields`);
  console.assert(remainingModules === 0, `FAIL: ${remainingModules} modules still have old fields`);
  console.log("Migration verified: no documents retain the old assignee/lead/collaborators fields.");

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it against the dev database and verify idempotency**

Run: `cd backend && node --env-file=.env scripts/migrate-assignees.js`
Expected: prints a migrated count (may be 0 if the dev DB has no tasks/modules yet — that's fine) followed by "Migration verified: no documents retain the old assignee/lead/collaborators fields."

Run it again immediately: `node --env-file=.env scripts/migrate-assignees.js`
Expected: prints "Migrated 0 tasks, 0 modules." and the same verified line — proves idempotency (nothing left to migrate, no errors on already-migrated docs).

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/migrate-assignees.js
git commit -m "feat: add one-shot migration merging assignee/lead+collaborators into assignees[]"
```

---

### Task 3: Frontend — assignment forms

**Files:**
- Modify: `frontend/components/tasks/TaskDialog.jsx`
- Modify: `frontend/components/tasks/TaskDrawer.jsx`
- Modify: `frontend/components/projects/ModuleDialog.jsx`

**Interfaces:**
- Consumes: `POST /tasks` and `PATCH /tasks/:id` now accept `assignees: string[]` (Task 1). `POST/PATCH /projects/:projectId/modules*` now accept `assignees: string[]` (Task 1).
- Consumes: task/module objects returned from the API now have `assignees: [{_id, name, role, designation}]` (populated) instead of `assignee`/`lead` + `collaborators`.

- [ ] **Step 1: `TaskDialog.jsx` — collapse to one multi-select**

Replace the `reset(...)` defaults:
```js
      reset({
        project: "",
        module: "",
        title: "",
        description: "",
        assignees: [],
        priority: "medium",
        estimatedHours: "",
        deadline: "",
        labels: "",
      });
```

Replace the mutation's `assignee: values.assignee || null,` line — just delete it, `values.assignees` (an array from the multi-select) passes through unchanged in the `...values` spread.

Replace the two-select block:
```js
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Assignees" multiple size={Math.min(4, directory.length || 1)} {...register("assignees")}>
            {directory.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
```
(this replaces the old "Assignee" single-select + "Collaborators" multi-select pair; it now spans the row alone, so drop the `sm:grid-cols-2` sibling — replace `grid-cols-1 gap-4 sm:grid-cols-2` with just `gap-4` on this wrapping div since there's only one field left.)

- [ ] **Step 2: `TaskDrawer.jsx` — one multi-select, updated permission check**

Replace:
```js
  const isAssignee = task?.assignees?.some((a) => a._id === me?._id);
```

Replace the "Assignee" single-select in the 3-column grid with a 2-column grid (Status, Priority only) — move assignees to its own labeled multi-select block, matching the existing Collaborators block's structure:
```js
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Status"
              value={task.status}
              disabled={!canEditStatus || patch.isPending}
              onChange={(e) => patch.mutate({ status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </Select>
            <Select
              label="Priority"
              value={task.priority}
              disabled={!canManage || patch.isPending}
              onChange={(e) => patch.mutate({ priority: e.target.value })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label htmlFor="assignees" className="text-sm font-medium">
              Assignees
            </label>
            <select
              id="assignees"
              multiple
              value={(task.assignees || []).map((a) => a._id)}
              disabled={!canManage || patch.isPending}
              onChange={(e) =>
                patch.mutate({ assignees: Array.from(e.target.selectedOptions, (o) => o.value) })
              }
              className="mt-1 w-full rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary disabled:opacity-50"
              size={Math.min(4, directory.length || 1)}
            >
              {directory.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">Ctrl/Cmd-click to select multiple.</p>
          </div>
```
Delete the old separate "Collaborators" `<label htmlFor="collaborators">...</select>` block entirely (it's superseded by the block above).

- [ ] **Step 3: `ModuleDialog.jsx` — collapse to one multi-select, drop role filter**

Replace the `reset(...)` defaults:
```js
      reset({
        name: module?.name || "",
        description: module?.description || "",
        assignees: (module?.assignees || []).map((a) => a._id || a),
        status: module?.status || "planning",
        deadline: module?.deadline ? module.deadline.slice(0, 10) : "",
      });
```

Replace the mutation payload builder:
```js
    mutationFn: (values) => {
      const payload = { ...values, deadline: values.deadline || null };
      return isEdit
        ? updateModule({ projectId, moduleId: module._id, ...payload })
        : createModule({ projectId, ...payload });
    },
```

Delete the `leadOptions` line entirely (`const leadOptions = directory.filter(...)`) — no longer used.

Replace the two-select block:
```js
        <Select label="Assignees" multiple size={Math.min(4, directory.length || 1)} {...register("assignees")}>
          {directory.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name}
            </option>
          ))}
        </Select>
```
(replaces both the "Lead" select and the "Collaborators" select; since it's now a single field, drop the wrapping `grid grid-cols-1 gap-4 sm:grid-cols-2` div — render it directly as a sibling of the `Textarea` above.)

- [ ] **Step 4: Manual verification**

Start the app (`npm run dev` in both `backend/` and `frontend/`), log in as a manager. Open the task creation dialog: confirm only one "Assignees" multi-select appears (no separate "Assignee"/"Collaborators"). Select 2 people, create the task, reopen it in `TaskDrawer` and confirm both show as selected. Repeat for a module in `ModuleDialog` and confirm the "Lead" field is gone and any directory member (not just managers/subleads) is selectable.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/tasks/TaskDialog.jsx frontend/components/tasks/TaskDrawer.jsx \
  frontend/components/projects/ModuleDialog.jsx
git commit -m "feat: collapse assignee+collaborators selects into one assignees multi-select"
```

---

### Task 4: Frontend — display components

**Files:**
- Modify: `frontend/components/tasks/TaskTable.jsx`
- Modify: `frontend/components/kanban/KanbanCard.jsx`
- Modify: `frontend/components/dashboard/TaskMiniList.jsx`
- Modify: `frontend/app/(app)/projects/[id]/page.js`

**Interfaces:**
- Consumes: `task.assignees` / `module.assignees` as populated `[{_id, name, role, designation}]` arrays (Task 1's API shape).

- [ ] **Step 1: `TaskTable.jsx` — render assignee names**

Replace the header cell:
```js
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Assignees</th>
```

Replace the data cell:
```js
              <td className="hidden px-4 py-3 text-muted sm:table-cell">
                {t.assignees?.length ? t.assignees.map((a) => a.name).join(", ") : "Unassigned"}
              </td>
```

- [ ] **Step 2: `KanbanCard.jsx` — render up to 2 initials badges**

Replace:
```js
        {task.assignees?.length > 0 && (
          <div className="flex -space-x-1.5">
            {task.assignees.slice(0, 3).map((a) => (
              <span
                key={a._id}
                title={a.name}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-surface bg-background text-[10px] font-semibold uppercase"
              >
                {a.name.slice(0, 2)}
              </span>
            ))}
          </div>
        )}
```
(this replaces the single `task.assignee?.name` badge block; keep everything else in the file unchanged.)

- [ ] **Step 3: `TaskMiniList.jsx` — render joined names**

Replace:
```js
          {showAssignee && t.assignees?.length > 0 && (
            <span className="shrink-0 text-xs text-muted">{t.assignees.map((a) => a.name).join(", ")}</span>
          )}
```

- [ ] **Step 4: `projects/[id]/page.js` — module card assignees line**

Replace:
```js
                  {m.assignees?.length > 0 && (
                    <p className="mt-1 truncate text-xs text-muted">
                      Assigned: {m.assignees.map((a) => a.name).join(", ")}
                    </p>
                  )}
```

- [ ] **Step 5: Manual verification**

In the browser: view the Kanban board and confirm a 2-assignee task shows two initials badges. View the Tasks list table and confirm the Assignees column lists both names. View a project's Modules tab and confirm the "Assigned: X, Y" line appears for a multi-assignee module. Check the dashboard's "Today's tasks" / "Upcoming" mini-lists show both assignee names where applicable.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/tasks/TaskTable.jsx frontend/components/kanban/KanbanCard.jsx \
  frontend/components/dashboard/TaskMiniList.jsx "frontend/app/(app)/projects/[id]/page.js"
git commit -m "feat: render multi-assignee lists in task table, kanban cards, mini-lists, module cards"
```
