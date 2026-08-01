# Clickable module cards → related-tasks drawer

## Problem

On a project's detail page (`/projects/[id]`), the **Modules** tab renders a grid
of module cards. The cards are inert — only the small edit-pencil icon (visible
to managers) responds to clicks. There is no way to see which tasks belong to a
given module without switching to the **Tasks** tab and hunting manually. The
backend already supports filtering tasks by module (`GET /tasks?project=&module=`),
so this is a frontend-only gap.

## Goal

Clicking a module card opens a slide-out drawer listing that module's tasks.
Clicking a task in that drawer opens the existing single-task drawer on top,
consistent with how the Tasks/Bugs tabs already open tasks.

## Design

### 1. Card click (`app/(app)/projects/[id]/page.js`)

Each module card (around line 189) gets an `onClick` that sets:

```js
const [selectedModule, setSelectedModule] = useState(null);
```

`onClick={() => setSelectedModule(m)}` on the card container. The existing
edit-pencil `<button>` inside the card gets `onClick={(e) => { e.stopPropagation(); ... }}`
added so it keeps opening `ModuleDialog` without also opening the new drawer.
Card gets `cursor-pointer` and a hover treatment consistent with `TaskTable`
rows (`hover:bg-background`-style affordance).

### 2. New component: `components/projects/ModuleTasksDrawer.jsx`

Mirrors the existing `TaskDrawer` component's shape (uses the shared `Drawer`
UI primitive rather than inventing a new overlay):

- Props: `module`, `projectId`, `onClose`, `onOpenTask`.
- `open={Boolean(module)}`.
- Title: `module?.name`.
- React-query: `fetchTasks({ project: projectId, module: module._id })`,
  `enabled: Boolean(module)`, `queryKey: ["tasks", { project: projectId, module: module?._id }]`.
- Loading state: reuse `Skeleton` (same pattern as the page's own loading state).
- Renders the existing `TaskTable` component with the fetched tasks, wiring
  `onOpen={onOpenTask}`.
- Empty state: existing `EmptyState` component, heading "No tasks in this module yet".

No new task-list rendering logic — `TaskTable` is reused as-is.

### 3. Task click-through

`ModuleTasksDrawer`'s `onOpenTask` prop is wired to the page's existing
`setOpenTask`, the same state that already backs the page-level `TaskDrawer`
used by the Tasks and Bugs tabs. Clicking a row in the module drawer opens the
existing `TaskDrawer` on top of it — both are `Drawer`-based (`z-40`, DOM-order
stacking), so this works without any z-index changes.

### 4. Closing behavior

- Closing the module drawer: `setSelectedModule(null)`.
- Closing the task drawer on top: `setOpenTask(null)`, leaving the module
  drawer open underneath (matches existing `TaskDrawer` close behavior
  elsewhere on the page).

## Out of scope

- No backend changes — the `module` query param on `GET /tasks` already exists.
- No changes to `ModuleDialog`, `ModuleKanbanCard`, or the modules-kanban page.
- No new empty/error states beyond what `EmptyState`/`Skeleton` already provide.

## Testing

Manual verification in the browser (dev server): open a project with modules
and tasks assigned to a module, click a module card, confirm the drawer shows
only that module's tasks, click a task, confirm the task drawer opens on top,
close both, confirm the pencil-icon edit flow still works independently of
the new click handler.
