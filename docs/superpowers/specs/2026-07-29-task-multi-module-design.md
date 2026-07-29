# Multi-Module Tasks

Date: 2026-07-29

## Problem

A Task currently belongs to at most one `ProjectModule` (`Task.module`, a nullable scalar ObjectId ref). A task should be able to belong to multiple modules at once — reflecting that a piece of work can span more than one work-stream within a project.

## Scope

Backend schema/logic change plus two frontend surfaces (task creation, task editing). No change to how modules themselves work (module CRUD, module kanban) beyond how they count tasks.

## Data model

- `backend/src/models/Task.js`: replace `module: { type: ObjectId, ref: "ProjectModule", default: null }` with `modules: [{ type: ObjectId, ref: "ProjectModule" }]`, default `[]`.
- One-time migration script (`backend/scripts/migrate-task-modules.js`, following this repo's existing `migrate-*.js` convention): for every task, set `modules: task.module ? [task.module] : []`, then unset the old `module` field.

## Backend logic

- **`createTask`/`updateTask`** (`taskController.js`): accept `modules` (array of ids) in place of `module`. Validate every id belongs to the task's project (same `ProjectModule.findOne({_id, project})` check as today, looped over the array — reject with the existing 400 message if any id doesn't belong).
- **`listTasks`'s `?module=` filter**: unchanged param name and behavior — `filter.modules = moduleId` matches "array contains this id" the same way Mongoose already matches a scalar field, so no new query shape is needed.
- **Module deletion** (`moduleController.js`'s `deleteModule`): no longer unconditionally deletes every task with that module. New sequence: find the ids of tasks that currently include the module being deleted → `$pull` the module out of every task's `modules` array → delete only the tasks (from that same id set) now left with an empty `modules` array. A task that still belongs to another module survives with that module removed from its list.
- **Module progress** (`backend/src/utils/progress.js`'s `computeProjectProgress` and `modulesWithProgress`): the per-module task match changes from `String(t.module) === String(m._id)` to `t.modules.some((tm) => String(tm) === String(m._id))`. A task in two modules counts toward both modules' task counts and completion percentages independently — this is a deliberate change from today's exactly-one-bucket counting.
- **Recurrence** (`taskController.js`, auto-created follow-on task on completion): copies `modules: task.modules` forward (was `module: task.module`).
- **Work-log rendering** (`followUpController.js`): `.populate("module", "name")` → `.populate("modules", "name")`; the per-task line's module suffix changes from a single `(ModuleName)` to a comma-joined list, e.g. `(Onboarding, Auth)`, and omits the parenthetical entirely when `modules` is empty (same as today's `null` case).

## Frontend

- **`TaskDialog.jsx`** (task creation): replace the single `<Select label="Module">` with the existing `MultiSelect` component (already used elsewhere in this app for project members/assignees — no new component). Form field renamed `modules`, defaults to `[]`; submission payload sends `modules: values.modules || []`.
- **`TaskDrawer.jsx`** (existing-task view — currently has no module UI at all, module is only ever set at creation today): add a Modules field using the same `MultiSelect`, wired to `PATCH /tasks/:id`. Editable only for the roles that already get full task-editing rights (sublead/manager/admin/subadmin) — matching the existing `FULL_FIELDS` vs `ASSIGNEE_FIELDS` split; a plain assignee sees it rendered but disabled, same as this view's existing Priority/Assignees fields for that role, not hidden outright.

## Testing / verification plan

Extend the existing `smoke-tasks-extra.js` (or add a focused new smoke script if that file is already large) with assertions covering, using this repo's existing assert-based/no-mocks smoke-test style:

1. Creating a task with multiple `modules` persists all of them.
2. `?module=<id>` list filter returns a task that has that module among several.
3. A module's progress/task-count includes a task that also belongs to a second module.
4. Deleting a module that a task shares with another module: the task survives, with only the deleted module removed from its `modules` list.
5. Deleting a module that is a task's only module: the task is hard-deleted (existing behavior, now scoped to "no modules left" rather than "had this module").
6. The migration script correctly converts a fixture task with an existing single `module` value into a one-element `modules` array, and a moduleless task into `[]`.

## Out of scope

No change to module CRUD itself, the modules-kanban board (module cards, not per-task), or any admin/subadmin scoping (modules already inherit their project's existing visibility rules, untouched by this change).
