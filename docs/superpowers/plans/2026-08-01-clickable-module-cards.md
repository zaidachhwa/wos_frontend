# Clickable Module Cards → Tasks Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a module card on a project's Modules tab opens a slide-out drawer listing that module's tasks; clicking a task in that drawer opens the existing task drawer on top.

**Architecture:** One new component, `ModuleTasksDrawer`, mirrors the existing `TaskDrawer`'s shape (wraps the shared `Drawer` primitive, fetches with react-query, renders the existing `TaskTable`). The project detail page wires a click handler on each module card to open it, and passes its existing `setOpenTask` through so the new drawer can hand off to the existing single-task `TaskDrawer`.

**Tech Stack:** Next.js 16 (App Router, `"use client"` components), `@tanstack/react-query` v5, existing UI primitives (`Drawer`, `Skeleton`, `EmptyState`), no test runner configured in this repo — verification is `npm run lint` plus manual browser check against the dev server.

## Global Constraints

- No backend changes. `GET /tasks` already accepts `project` and `module` query params (`backend/src/controllers/taskController.js:291`).
- No new dependencies — reuse `Drawer`, `TaskTable`, `EmptyState`, `Skeleton`, react-query, all already in `frontend/package.json`.
- Follow existing component conventions: `"use client"` at top, named default export, Tailwind utility classes matching the surrounding file (no new color/spacing tokens).
- This repo has no test framework (`frontend/package.json` has no `test` script, no jest/vitest/playwright). Do not add one for this feature. Verification is `npm run lint` (must pass with zero new errors) and a manual click-through in the dev server, per task.

---

### Task 1: `ModuleTasksDrawer` component

**Files:**
- Create: `frontend/components/projects/ModuleTasksDrawer.jsx`

**Interfaces:**
- Consumes: `Drawer` (`frontend/components/ui/Drawer.jsx`, props `{ open, onClose, title, children, wide }`), `TaskTable` (`frontend/components/tasks/TaskTable.jsx`, props `{ tasks, onOpen }` used here), `EmptyState` (`frontend/components/ui/EmptyState.jsx`, props `{ icon, heading, description }`), `Skeleton` (`frontend/components/ui/Skeleton.jsx`, prop `{ className }`), `fetchTasks` (`frontend/services/taskService.js`, signature `fetchTasks(filters) -> Promise<Task[]>`, filters object keys become query params, falsy values dropped).
- Produces: default export `ModuleTasksDrawer({ module, projectId, onClose, onOpenTask })` — `module` is `null` or `{ _id, name, ... }`; `onOpenTask(task)` is called when a task row is clicked. Task 2 relies on this exact prop signature.

- [ ] **Step 1: Write the component**

```jsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";

import Drawer from "@/components/ui/Drawer";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import TaskTable from "@/components/tasks/TaskTable";
import { fetchTasks } from "@/services/taskService";

export default function ModuleTasksDrawer({ module, projectId, onClose, onOpenTask }) {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", { project: projectId, module: module?._id }],
    queryFn: () => fetchTasks({ project: projectId, module: module._id }),
    enabled: Boolean(module),
  });

  return (
    <Drawer open={Boolean(module)} onClose={onClose} title={module?.name || "Module tasks"} wide>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : tasks.length ? (
        <TaskTable tasks={tasks} onOpen={onOpenTask} />
      ) : (
        <EmptyState icon={ClipboardList} heading="No tasks in this module yet" />
      )}
    </Drawer>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors reported for `components/projects/ModuleTasksDrawer.jsx`.

- [ ] **Step 3: Commit**

```bash
git add components/projects/ModuleTasksDrawer.jsx
git commit -m "Add ModuleTasksDrawer component"
```

---

### Task 2: Wire clickable module cards into the project detail page

**Files:**
- Modify: `frontend/app/(app)/projects/[id]/page.js`

**Interfaces:**
- Consumes: `ModuleTasksDrawer` from Task 1 (`{ module, projectId, onClose, onOpenTask }`).
- Produces: nothing consumed by later tasks (this is the last task).

- [ ] **Step 1: Import the new component**

In `frontend/app/(app)/projects/[id]/page.js`, add to the imports (after the `ModuleDialog` import at line 16):

```js
import ModuleTasksDrawer from "@/components/projects/ModuleTasksDrawer";
```

- [ ] **Step 2: Add state for the selected module**

Add alongside the other `useState` calls (after line 37, the `moduleDialog` state):

```js
  const [selectedModule, setSelectedModule] = useState(null);
```

- [ ] **Step 3: Make the module card clickable and guard the edit button**

Replace the module card block (current lines 189–219):

```js
              {project.modules.map((m) => (
                <div key={m._id} className="rounded-card border border-border bg-surface p-6">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold">{m.name}</p>
                    <div className="flex items-center gap-1">
                      <Badge value={m.status} />
                      {canManageModules && (
                        <button
                          onClick={() => setModuleDialog({ open: true, module: m })}
                          aria-label={`Edit ${m.name}`}
                          className="rounded-btn p-1 text-muted transition-colors duration-150 hover:bg-background hover:text-primary"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{m.description || "No description."}</p>
                  <div className="mt-4">
                    <ProgressBar value={m.progress} />
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    {m.taskCount ?? 0} tasks · {m.deadline ? `due ${new Date(m.deadline).toLocaleDateString()}` : "no deadline"}
                  </p>
                  {m.assignees?.length > 0 && (
                    <p className="mt-1 truncate text-xs text-muted">
                      Assigned: {m.assignees.map((a) => a.name).join(", ")}
                    </p>
                  )}
                </div>
              ))}
```

with:

```js
              {project.modules.map((m) => (
                <div
                  key={m._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedModule(m)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedModule(m);
                    }
                  }}
                  className="cursor-pointer rounded-card border border-border bg-surface p-6 transition-colors duration-150 hover:bg-background"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold">{m.name}</p>
                    <div className="flex items-center gap-1">
                      <Badge value={m.status} />
                      {canManageModules && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setModuleDialog({ open: true, module: m });
                          }}
                          aria-label={`Edit ${m.name}`}
                          className="rounded-btn p-1 text-muted transition-colors duration-150 hover:bg-background hover:text-primary"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{m.description || "No description."}</p>
                  <div className="mt-4">
                    <ProgressBar value={m.progress} />
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    {m.taskCount ?? 0} tasks · {m.deadline ? `due ${new Date(m.deadline).toLocaleDateString()}` : "no deadline"}
                  </p>
                  {m.assignees?.length > 0 && (
                    <p className="mt-1 truncate text-xs text-muted">
                      Assigned: {m.assignees.map((a) => a.name).join(", ")}
                    </p>
                  )}
                </div>
              ))}
```

- [ ] **Step 4: Render the drawer**

Add right after the closing `</ModuleDialog>` tag's `/>` (after current line 270, before the `<TaskDrawer task={openTask}...` line):

```js
      <ModuleTasksDrawer
        module={selectedModule}
        projectId={id}
        onClose={() => setSelectedModule(null)}
        onOpenTask={setOpenTask}
      />
```

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 6: Manual verification**

Run: `npm run dev` (if not already running), then in the browser:
1. Open a project's detail page, switch to the Modules tab.
2. Click a module card (not the pencil icon) → drawer opens titled with the module's name, showing that module's tasks (or the "No tasks in this module yet" empty state).
3. Click a task row inside the drawer → the existing task drawer opens on top, showing task detail.
4. Close the task drawer → module tasks drawer is still open behind it.
5. Close the module tasks drawer → back to the Modules tab.
6. As a manager/admin, click the pencil icon on a card → `ModuleDialog` opens for editing, the tasks drawer does NOT also open.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/projects/[id]/page.js"
git commit -m "Make module cards clickable, open a tasks drawer for the module"
```
