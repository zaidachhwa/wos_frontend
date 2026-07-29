# Multi-Module Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Task can belong to zero, one, or multiple `ProjectModule`s instead of at most one, with matching migration, cascade-delete, progress-counting, and UI changes.

**Architecture:** `Task.module` (nullable scalar ref) becomes `Task.modules` (array of refs, default `[]`). Every consumer of the old scalar field — creation/update validation, the list filter, module-progress counting, module-delete cascade, the EOD work-log renderer, and both task dialogs — is updated to the array shape. A migration script converts existing data once.

**Tech Stack:** Express 5 + Mongoose (backend), Next.js + react-hook-form + the existing `MultiSelect` component (frontend). No new dependencies.

## Global Constraints

- Deleting a module unlinks it from every task that has it; a task is hard-deleted only if that was its *last* remaining module (not "always delete tasks in this module," per today's behavior).
- A task in multiple modules counts toward each module's task count and completion percentage independently.
- Modules become editable in `TaskDrawer` (existing-task view) for the first time — restricted to the same roles that already get full task-editing rights (`admin`, `manager`, `subadmin`, `sublead`), not plain assignees.
- Spec: `docs/superpowers/specs/2026-07-29-task-multi-module-design.md`

---

### Task 1: Schema, migration, and create/update/list validation

**Files:**
- Modify: `backend/src/models/Task.js:30`
- Create: `backend/scripts/migrate-task-modules.js`
- Modify: `backend/src/controllers/taskController.js` (`createTask`, `updateTask`'s `FULL_FIELDS` + module-validation block, `listTasks`, the recurrence auto-create block)

**Interfaces:**
- Produces: `Task.modules` — `ObjectId[]`, default `[]`. Every later task in this plan reads/writes this field name.

- [ ] **Step 1: Change the schema field**

In `backend/src/models/Task.js`, replace line 30:

```js
    module: { type: mongoose.Schema.Types.ObjectId, ref: "ProjectModule", default: null },
```

with:

```js
    modules: [{ type: mongoose.Schema.Types.ObjectId, ref: "ProjectModule" }],
```

- [ ] **Step 2: Write the migration script**

Create `backend/scripts/migrate-task-modules.js`, following this repo's existing `migrate-assignees.js` convention (raw driver, cursor, `$set`/`$unset`, self-verification):

```js
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

const run = async () => {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const coll = db.collection("tasks");

  const cursor = coll.find({ module: { $exists: true } });
  let migrated = 0;
  for await (const doc of cursor) {
    const modules = doc.module ? [doc.module] : [];
    await coll.updateOne({ _id: doc._id }, { $set: { modules }, $unset: { module: "" } });
    migrated += 1;
  }
  console.log(`Migrated ${migrated} tasks.`);

  const remaining = await coll.countDocuments({ module: { $exists: true } });
  console.assert(remaining === 0, `FAIL: ${remaining} tasks still have the old module field`);
  console.log("Migration verified: no documents retain the old module field.");

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Update `createTask`'s module handling**

In `backend/src/controllers/taskController.js`, replace lines 40-55 (the destructure) — change:

```js
      module: moduleId,
```

to:

```js
      modules,
```

Replace lines 69-74:

```js
    if (moduleId) {
      const projectModule = await ProjectModule.findOne({ _id: moduleId, project: project._id });
      if (!projectModule) {
        return res.status(400).json({ success: false, message: "module must belong to the project" });
      }
    }
```

with:

```js
    for (const moduleId of modules || []) {
      const projectModule = await ProjectModule.findOne({ _id: moduleId, project: project._id });
      if (!projectModule) {
        return res.status(400).json({ success: false, message: "module must belong to the project" });
      }
    }
```

Replace line 83:

```js
      module: moduleId || null,
```

with:

```js
      modules: modules || [],
```

- [ ] **Step 4: Update `updateTask`'s `FULL_FIELDS` and module validation**

Replace line 21 (`"module",` inside the `FULL_FIELDS` array) with:

```js
  "modules",
```

Replace lines 350-355:

```js
    if (req.body.module) {
      const projectModule = await ProjectModule.findOne({ _id: req.body.module, project: task.project });
      if (!projectModule) {
        return res.status(400).json({ success: false, message: "module must belong to the project" });
      }
    }
```

with:

```js
    for (const moduleId of req.body.modules || []) {
      const projectModule = await ProjectModule.findOne({ _id: moduleId, project: task.project });
      if (!projectModule) {
        return res.status(400).json({ success: false, message: "module must belong to the project" });
      }
    }
```

(The generic `for (const key of allowedFields) { if (key in req.body) task[key] = req.body[key]; }` loop at lines 361-363 already handles assigning `task.modules = req.body.modules` once `"modules"` replaces `"module"` in `FULL_FIELDS` — no separate assignment line needed.)

- [ ] **Step 5: Update `listTasks`'s module filter**

Replace line 251:

```js
    if (module) filter.module = module;
```

with:

```js
    if (module) filter.modules = module;
```

(The query param name `?module=` is unchanged — Mongoose matches "array field contains this scalar value" the same way it matches a plain scalar-field equality, so no `$in`/array wrapping is needed for a single value.)

- [ ] **Step 6: Update the recurrence auto-create block**

In `updateTask`, replace line 430:

```js
        module: task.module,
```

with:

```js
        modules: task.modules,
```

- [ ] **Step 7: Run the migration script and the smoke suite**

A backend dev server should be running (`npm run dev`, in the background). Run the migration script once against the dev database:

Run: `cd backend && node --env-file=.env scripts/migrate-task-modules.js`
Expected: prints `Migrated N tasks.` (N may be 0 on a fresh/already-migrated DB) and `Migration verified: no documents retain the old module field.`

Then run: `cd backend && npm run smoke`
Expected: most scripts pass; `smoke-projects.js` and `smoke-tasks-extra.js` will FAIL at this point — they still send the old `module:` payload key, which Step 3-4's renamed destructure no longer reads (Task 3 of this plan updates those scripts). Confirm the failures are specifically about module-related assertions (e.g. `taskCreated.data.data.task.assignees.length` or module-progress checks), not something unrelated — this confirms your change took effect, not that something else broke.

- [ ] **Step 8: Commit**

```bash
git add backend/src/models/Task.js backend/scripts/migrate-task-modules.js backend/src/controllers/taskController.js
git commit -m "feat: change Task.module to Task.modules (array), add migration script"
```

---

### Task 2: Module-deletion cascade and progress computation

**Files:**
- Modify: `backend/src/controllers/moduleController.js:98-121` (`deleteModule`)
- Modify: `backend/src/utils/progress.js` (`computeProjectProgress`, `modulesWithProgress`)

**Interfaces:**
- Consumes: `Task.modules` (Task 1).

- [ ] **Step 1: Change `deleteModule`'s cascade behavior**

In `backend/src/controllers/moduleController.js`, replace line 107:

```js
    await Task.deleteMany({ module: projectModule._id });
```

with:

```js
    // Unlink the deleted module from every task that has it, then hard-delete
    // only the tasks that are left with zero modules as a result — a task
    // that still belongs to another module survives with this one removed.
    const affectedTaskIds = await Task.find({ modules: projectModule._id }).distinct("_id");
    await Task.updateMany({ _id: { $in: affectedTaskIds } }, { $pull: { modules: projectModule._id } });
    await Task.deleteMany({ _id: { $in: affectedTaskIds }, modules: { $size: 0 } });
```

- [ ] **Step 2: Update `computeProjectProgress`'s per-module matching**

In `backend/src/utils/progress.js`, replace lines 14-22:

```js
  const [modules, tasks] = await Promise.all([
    ProjectModule.find({ project: projectId }).select("_id").lean(),
    Task.find({ project: projectId }).select("module status").lean(),
  ]);
  const units = modules.map((m) =>
    moduleProgress(tasks.filter((t) => String(t.module) === String(m._id)))
  );
  for (const t of tasks) {
    if (!t.module) units.push(t.status === "completed" ? 1 : 0);
  }
```

with:

```js
  const [modules, tasks] = await Promise.all([
    ProjectModule.find({ project: projectId }).select("_id").lean(),
    Task.find({ project: projectId }).select("modules status").lean(),
  ]);
  const units = modules.map((m) =>
    moduleProgress(tasks.filter((t) => (t.modules || []).some((tm) => String(tm) === String(m._id))))
  );
  for (const t of tasks) {
    if (!t.modules || !t.modules.length) units.push(t.status === "completed" ? 1 : 0);
  }
```

- [ ] **Step 3: Update `modulesWithProgress`'s per-module matching**

Replace lines 33-36:

```js
    Task.find({ project: projectId }).select("module status").lean(),
  ]);
  return modules.map((m) => {
    const moduleTasks = tasks.filter((t) => String(t.module) === String(m._id));
```

with:

```js
    Task.find({ project: projectId }).select("modules status").lean(),
  ]);
  return modules.map((m) => {
    const moduleTasks = tasks.filter((t) => (t.modules || []).some((tm) => String(tm) === String(m._id)));
```

- [ ] **Step 4: Run the smoke suite**

Run: `cd backend && npm run smoke`
Expected: `smoke-projects.js`/`smoke-tasks-extra.js` still fail at this point (Task 3 fixes their payloads) — confirm no NEW failures appeared beyond what Task 1 already produced (i.e., this task didn't break anything further; the same module-related assertions still fail for the same reason).

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/moduleController.js backend/src/utils/progress.js
git commit -m "feat: unlink-then-delete-if-orphaned on module deletion, per-module task counting for multi-module tasks"
```

---

### Task 3: Work-log rendering + full smoke coverage

**Files:**
- Modify: `backend/src/controllers/followUpController.js:219,222`
- Modify: `backend/scripts/smoke-projects.js` (update existing module-related assertions to the array shape, add new coverage)

**Interfaces:**
- Consumes: `Task.modules` (Task 1), the unlink-then-delete cascade (Task 2).

- [ ] **Step 1: Update the work-log renderer**

In `backend/src/controllers/followUpController.js`, replace line 219:

```js
    }).populate("module", "name");
```

with:

```js
    }).populate("modules", "name");
```

Replace line 222:

```js
      ? tasks.map((t) => `- ${t.title}${t.module ? ` (${t.module.name})` : ""}`).join("\n")
```

with:

```js
      ? tasks.map((t) => `- ${t.title}${t.modules?.length ? ` (${t.modules.map((m) => m.name).join(", ")})` : ""}`).join("\n")
```

- [ ] **Step 2: Fix the existing module/task fixtures in `smoke-projects.js` to use the array field**

Replace line 197 (inside `taskWrongModule`):

```js
    { project: projectId, module: "000000000000000000000000", title: "Bad module" },
```

with:

```js
    { project: projectId, modules: ["000000000000000000000000"], title: "Bad module" },
```

Replace line 204 (inside `taskCreated`):

```js
    { project: projectId, module: moduleId, title: "Build API", assignees: [member.userId, outsiderSublead.userId] },
```

with:

```js
    { project: projectId, modules: [moduleId], title: "Build API", assignees: [member.userId, outsiderSublead.userId] },
```

Replace line 293 (inside `secondModuleTask`):

```js
    { project: projectId, module: moduleId, title: "Second module task" },
```

with:

```js
    { project: projectId, modules: [moduleId], title: "Second module task" },
```

- [ ] **Step 3: Add coverage for multi-module assignment, filtering, and progress double-counting**

Insert this block right after the existing `secondModuleTask`/`noModuleTask`/`completeNoModuleTask`/`projectWithProgress` block (after line 316, before the `--- Delete ---` section at line 318):

```js
  // --- Multi-module tasks ---------------------------------------------------

  const moduleB = await axios.post(
    `${BASE}/projects/${projectId}/modules`,
    { name: "Frontend module" },
    manager.auth
  );
  assert.equal(moduleB.status, 201, "manager creates a second module");
  const moduleBId = moduleB.data.data.module._id;

  const multiModuleTask = await axios.post(
    `${BASE}/tasks`,
    { project: projectId, modules: [moduleId, moduleBId], title: "Spans two modules" },
    manager.auth
  );
  assert.equal(multiModuleTask.status, 201, "creates a task in two modules at once");
  assert.deepEqual(
    multiModuleTask.data.data.task.modules.map(String).sort(),
    [moduleId, moduleBId].map(String).sort(),
    "task persists both module ids"
  );
  const multiModuleTaskId = multiModuleTask.data.data.task._id;

  const listByModuleId = await axios.get(`${BASE}/tasks?module=${moduleId}`, manager.auth);
  assert.ok(
    listByModuleId.data.data.tasks.some((t) => t._id === multiModuleTaskId),
    "?module= filter finds a task that has this module among several"
  );
  const listByModuleBId = await axios.get(`${BASE}/tasks?module=${moduleBId}`, manager.auth);
  assert.ok(
    listByModuleBId.data.data.tasks.some((t) => t._id === multiModuleTaskId),
    "?module= filter also finds it via the second module"
  );

  const modulesBeforeDelete = await axios.get(`${BASE}/projects/${projectId}/modules`, manager.auth);
  const moduleBBeforeDelete = modulesBeforeDelete.data.data.modules.find((m) => m._id === moduleBId);
  assert.ok(
    moduleBBeforeDelete.taskCount >= 1,
    "the multi-module task counts toward module B's task count"
  );
  const moduleABeforeDelete = modulesBeforeDelete.data.data.modules.find((m) => m._id === moduleId);
  assert.ok(
    moduleABeforeDelete.taskCount >= 1,
    "the same task also counts toward module A's task count (independent counting)"
  );

  // --- Module deletion: unlink-then-delete-if-orphaned ----------------------

  const deleteModuleBWithSurvivor = await axios.delete(
    `${BASE}/projects/${projectId}/modules/${moduleBId}`,
    manager.auth
  );
  assert.equal(deleteModuleBWithSurvivor.status, 200, "manager deletes module B");

  const taskAfterModuleBDelete = await axios.get(`${BASE}/tasks/${multiModuleTaskId}`, manager.auth);
  assert.equal(taskAfterModuleBDelete.status, 200, "the multi-module task survives — it still had module A");
  assert.deepEqual(
    taskAfterModuleBDelete.data.data.task.modules.map(String),
    [moduleId],
    "only module B was removed from its modules list"
  );

  const deleteModuleAOrphans = await axios.delete(
    `${BASE}/projects/${projectId}/modules/${moduleId}`,
    manager.auth
  );
  assert.equal(deleteModuleAOrphans.status, 200, "manager deletes module A (the task's last remaining module)");

  const taskAfterLastModuleDeleted = await axios.get(`${BASE}/tasks/${multiModuleTaskId}`, {
    ...manager.auth,
    validateStatus: () => true,
  });
  assert.equal(
    taskAfterLastModuleDeleted.status, 404,
    "the task is hard-deleted once its last remaining module is deleted"
  );
```

- [ ] **Step 4: Run the smoke suite**

Run: `cd backend && npm run smoke`
Expected: `smoke-projects.js: all checks passed` and the full chain passes (known pre-existing unrelated conditions — `smoke-auth.js`'s Google-configured-environment assertion, `smoke-followups.js` intermittent flakiness — are not this task's concern; rerun `smoke-followups.js` standalone once if it fails).

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/followUpController.js backend/scripts/smoke-projects.js
git commit -m "feat: render multiple module names in the EOD work log, extend smoke-projects.js for multi-module tasks"
```

---

### Task 4: Frontend — multi-select at task creation

**Files:**
- Modify: `frontend/components/tasks/TaskDialog.jsx`

**Interfaces:**
- Consumes: `MultiSelect` (`frontend/components/ui/MultiSelect.jsx`, already used in this same file for Assignees/Blocked-by — no new component).

- [ ] **Step 1: Replace the module `<Select>` with a `MultiSelect`**

Replace line 83 (inside the `reset({...})` call):

```js
        module: task?.module || "",
```

with:

```js
        modules: task?.modules?.map((m) => m._id || m) || [],
```

Replace line 104 (inside the `createTask({...})` mutation call):

```js
        module: values.module || null,
```

with:

```js
        modules: values.modules || [],
```

Replace lines 157-164:

```jsx
          <Select label="Module" {...register("module")}>
            <option value="">None</option>
            {modules.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </Select>
```

with:

```jsx
          <Controller
            name="modules"
            control={control}
            defaultValue={[]}
            render={({ field }) => (
              <MultiSelect
                label="Modules"
                items={modules}
                value={field.value}
                onChange={field.onChange}
                placeholder="None"
              />
            )}
          />
```

- [ ] **Step 2: Lint and build**

Run: `cd frontend && npm run lint && npm run build`
Expected: both exit 0 (pre-existing, unrelated lint issues in `TaskDialog.jsx`'s sibling files `TaskDrawer.jsx`/`UserDialog.jsx` are already known — confirm `TaskDialog.jsx` itself has zero NEW errors versus before this change).

- [ ] **Step 3: Manual verification in the browser**

Run: `cd backend && npm run dev` and `cd frontend && npm run dev`.
Log in, open Tasks → New task, pick a project that has at least two modules. Confirm the Modules field is a searchable multi-select (matching the existing Assignees field's look/behavior in the same dialog), that you can pick more than one module, and that submitting creates a task with all of them (verify via the task's detail view or `GET /tasks/:id`).

- [ ] **Step 4: Commit**

```bash
git add frontend/components/tasks/TaskDialog.jsx
git commit -m "feat: multi-select module picker on task creation"
```

---

### Task 5: Frontend — module editing on the existing-task view

**Files:**
- Modify: `frontend/components/tasks/TaskDrawer.jsx`

**Interfaces:**
- Consumes: `MultiSelect` (already imported in this file, used for Assignees), `fetchModules` (`frontend/services/projectService.js`).

- [ ] **Step 1: Widen `canManage` to include subadmin**

Replace line 140:

```js
  const canManage = ["admin", "manager", "sublead"].includes(me?.role);
```

with:

```js
  const canManage = ["admin", "manager", "subadmin", "sublead"].includes(me?.role);
```

(The backend's `SUBLEAD_PLUS` — which gates full task-field editing, including the new `modules` field this task adds — already includes `subadmin`. This one-line widening also fixes a pre-existing gap where a subadmin couldn't edit an in-scope task's priority/assignees/time-slot/bonus-points from this view despite the backend already allowing it.)

- [ ] **Step 2: Fetch the project's modules and add the Modules field**

Add a new import after line 24 (`import { fetchPointsConfig } from "@/services/leaderboardService";`):

```js
import { fetchModules } from "@/services/projectService";
```

Add a new query after the existing `pointsConfig` query (after line 58, the closing `});` of that `useQuery` call):

```js
  const { data: projectModules = [] } = useQuery({
    queryKey: ["modules", task?.project],
    queryFn: () => fetchModules(task.project),
    enabled: open && Boolean(task?.project),
  });
```

Add the `MultiSelect` field for Modules right after the existing Assignees `MultiSelect` block (after line 219, the closing `/>` of the Assignees `MultiSelect`, before the `{task.blockedBy?.length > 0 && (...)}` block that starts at line 221):

```jsx
          <MultiSelect
            label="Modules"
            items={projectModules}
            value={(task.modules || []).map((m) => m._id || m)}
            disabled={!canManage || patch.isPending}
            onChange={(modules) => patch.mutate({ modules })}
            placeholder="None"
          />
```

- [ ] **Step 3: Lint and build**

Run: `cd frontend && npm run lint && npm run build`
Expected: both exit 0 (confirm `TaskDrawer.jsx` has zero NEW errors versus before this change; its one pre-existing warning is unrelated and untouched).

- [ ] **Step 4: Manual verification in the browser**

Open an existing task (with a project that has modules) in the drawer. Confirm a Modules field appears, pre-populated with the task's current modules, editable by an admin/manager/sublead/subadmin account and read-only (or absent) for a plain assignee. Change the selection and confirm it persists (refetch or reopen the drawer). Confirm a plain assignee viewing their own assigned task does not see an editable Modules field (matches how Priority/Assignees already behave for that role in this same view).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/tasks/TaskDrawer.jsx
git commit -m "feat: add module editing to the task detail view, widen canManage to include subadmin"
```
