# Calendar Multi-Day Task Spans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tasks with a deadline more than one day out render as a single continuous bar spanning every day from today through the deadline on the calendar board, tagged with the task's project and visibly marked when completed.

**Architecture:** Backend `collectItems` (in `calendarController.js`) widens its task query to an overlap check and adds `spanStart`/`label`/`projectName`/`status` to each `task_deadline` item. The frontend calendar page turns multi-day items into `allDay` FullCalendar events (native multi-day bar rendering, no custom grid code), colors them per-project, and renders a custom `eventContent` for the label pill + completed styling.

**Tech Stack:** Express 5 + Mongoose (backend), Next.js 16 + `@fullcalendar/react` (frontend). No new dependencies.

## Global Constraints

- No changes to the `Task`, `Project`, or `TimeBlock` schemas — every field used (`deadline`, `createdAt`, `labels`, `status`, `project`) already exists.
- Single-day tasks (deadline ≤ 1 day from creation) keep today's exact rendering (point event via `combineDeadlineAndTime`).
- Spec: `docs/superpowers/specs/2026-07-27-calendar-multiday-task-spans-design.md`

---

### Task 1: Backend — overlap query + richer task_deadline payload

**Files:**
- Modify: `backend/src/controllers/calendarController.js:13,38-52`
- Modify: `backend/scripts/smoke-timeblocks.js` (extend the existing calendar-aggregate section, lines 126-158)

**Interfaces:**
- Produces: `task_deadline` items now include `spanStart` (Date|null — the task's `createdAt`), `label` (String|null — `labels[0]`), `projectName` (String|null), `status` (String, one of `TASK_STATUSES`). Existing fields (`id`, `type`, `title`, `start`, `startTime`, `endTime`, `link`) are unchanged.

- [ ] **Step 1: Change the task query to an overlap check and populate the project name**

In `backend/src/controllers/calendarController.js`, replace line 13:

```js
    Task.find({ assignees: userId, deadline: range }),
```

with:

```js
    // Overlap query, not "deadline falls in range": a task created today with
    // a deadline weeks out must still show on *this* week's board even though
    // its deadline isn't in this week — the visible span is [createdAt, deadline].
    Task.find({
      assignees: userId,
      deadline: { $gte: fromDate },
      createdAt: { $lte: toDate },
    }).populate("project", "name"),
```

- [ ] **Step 2: Add the new fields to the task_deadline payload**

Replace the loop at lines 38-52:

```js
  for (const t of tasks) {
    items.push({
      id: String(t._id),
      type: "task_deadline",
      title: t.title,
      // Raw pieces, not a pre-combined instant — the server doesn't know the
      // viewer's timezone, so combining "HH:mm" with the deadline's date
      // happens client-side (see wos_frontend's calendar page), the same
      // way <input type="time"> values are always treated as local.
      start: t.deadline,
      startTime: t.startTime || null,
      endTime: t.endTime || null,
      // The frontend uses createdAt as the span's start day; a task shown
      // less than a day after creation renders as today's single-point event.
      spanStart: t.createdAt,
      label: t.labels?.[0] || null,
      projectName: t.project?.name || null,
      status: t.status,
      link: "/tasks",
    });
  }
```

- [ ] **Step 3: Extend the calendar smoke test to cover the new fields and the overlap window**

In `backend/scripts/smoke-timeblocks.js`, replace the task-creation block at lines 133-143:

```js
  const task = await axios.post(
    `${BASE}/tasks`,
    {
      project: project.data.data.project._id,
      title: "Calendar smoke task",
      assignees: [member.userId],
      deadline: iso(5),
      labels: ["Sprint 12"],
    },
    manager.auth
  );
  assert.equal(task.status, 201, "task created for calendar smoke");

  // Deadline ten days out — outside the narrow window queried below — but the
  // task was just created, so its span [createdAt, deadline] still overlaps
  // the window and it must appear.
  const farTask = await axios.post(
    `${BASE}/tasks`,
    {
      project: project.data.data.project._id,
      title: "Far-deadline smoke task",
      assignees: [member.userId],
      deadline: iso(240),
    },
    manager.auth
  );
  assert.equal(farTask.status, 201, "far-deadline task created");

  // Deadline in the past, created in the past (simulated by a deadline before
  // the window's start) — must NOT appear, guarding against the overlap query
  // accidentally dropping the deadline lower bound.
  const pastTask = await axios.post(
    `${BASE}/tasks`,
    {
      project: project.data.data.project._id,
      title: "Past-deadline smoke task",
      assignees: [member.userId],
      deadline: iso(-48),
    },
    manager.auth
  );
  assert.equal(pastTask.status, 201, "past-deadline task created");
```

Then replace the assertions at lines 150-158:

```js
  const items = calendar.data.data.items;
  assert.ok(
    items.some((i) => i.type === "timeblock" && i.id === ownBlock.data.data.timeBlock._id),
    "calendar includes the member's time block"
  );
  const taskItem = items.find((i) => i.type === "task_deadline" && i.id === task.data.data.task._id);
  assert.ok(taskItem, "calendar includes the assigned task's deadline");
  assert.equal(taskItem.label, "Sprint 12", "task_deadline item carries the task's first label");
  assert.equal(taskItem.projectName, "Calendar smoke project", "task_deadline item carries the project's name");
  assert.equal(taskItem.status, "backlog", "task_deadline item carries the task's status");
  assert.ok(taskItem.spanStart, "task_deadline item carries a spanStart");

  assert.ok(
    items.some((i) => i.type === "task_deadline" && i.id === farTask.data.data.task._id),
    "far-deadline task still appears — its span overlaps the narrow query window"
  );
  assert.ok(
    !items.some((i) => i.type === "task_deadline" && i.id === pastTask.data.data.task._id),
    "past-deadline task does not appear — its span ended before the query window"
  );
```

- [ ] **Step 4: Run the smoke suite and verify it passes**

Run: `cd backend && npm run smoke`
Expected: every `smoke-*` script prints its "all checks passed" line, ending with `smoke-ai: all checks passed` (or whichever script is last in the chain), exit code 0. `smoke-timeblocks: all checks passed` must appear with no assertion errors above it.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/calendarController.js backend/scripts/smoke-timeblocks.js
git commit -m "feat: overlap-based calendar query with project/label/status on task_deadline items"
```

---

### Task 2: Frontend — per-project color palette

**Files:**
- Modify: `frontend/app/globals.css` (add 6 project color tokens to both the `:root` and `:root[data-theme="dark"]` blocks, alongside the existing `--cal-*` tokens)
- Create: `frontend/lib/projectColor.js`

**Interfaces:**
- Produces: `projectColor(name: string) => string` (a `var(--cal-proj-N)` CSS value), used by Task 3.

- [ ] **Step 1: Add project color tokens to globals.css**

In `frontend/app/globals.css`, after line 25 (`--cal-default: #8b8577;`) inside `:root`, add:

```css
  /* Per-project calendar bar colors — cycled by a name hash, same muted
     mid-tone family as the rest of the calendar palette. */
  --cal-proj-1: #5f8f6b;
  --cal-proj-2: #8a6bb0;
  --cal-proj-3: #6a86b0;
  --cal-proj-4: #b0955a;
  --cal-proj-5: #6bafae;
  --cal-proj-6: #a8708f;
```

After line 51 (`--cal-default: #9b9587;`) inside `:root[data-theme="dark"]`, add:

```css
  --cal-proj-1: #6fa17b;
  --cal-proj-2: #9a7bc0;
  --cal-proj-3: #7a96c0;
  --cal-proj-4: #c0a56a;
  --cal-proj-5: #7bbfbe;
  --cal-proj-6: #b8809f;
```

- [ ] **Step 2: Write the hashing util**

Create `frontend/lib/projectColor.js`:

```js
const PALETTE = ["--cal-proj-1", "--cal-proj-2", "--cal-proj-3", "--cal-proj-4", "--cal-proj-5", "--cal-proj-6"];

// Deterministic name -> palette slot, so the same project always gets the
// same color across renders and users without persisting a color per project.
export const projectColor = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return `var(${PALETTE[Math.abs(hash) % PALETTE.length]})`;
};
```

- [ ] **Step 3: Verify with a quick Node check**

Run: `node -e "const {projectColor}=await import('./frontend/lib/projectColor.js'); console.log(projectColor('Calendar smoke project'), projectColor('Calendar smoke project'), projectColor('Other project'))"`
Expected: first two values are identical (same project name → same color), third differs from the first in most cases (different hash).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/globals.css frontend/lib/projectColor.js
git commit -m "feat: per-project color tokens and name-hash color picker for the calendar"
```

---

### Task 3: Frontend — multi-day event rendering, label pill, completed styling

**Files:**
- Modify: `frontend/app/(app)/calendar/page.js`

**Interfaces:**
- Consumes: `projectColor(name)` from `frontend/lib/projectColor.js` (Task 2). Calendar items now carry `spanStart`, `label`, `projectName`, `status` (Task 1).

- [ ] **Step 1: Import projectColor and the Check icon**

In `frontend/app/(app)/calendar/page.js`, change line 11:

```js
import { Plus } from "lucide-react";
```

to:

```js
import { Plus, Check } from "lucide-react";
```

and add, after line 19 (`import { combineDeadlineAndTime } from "@/lib/taskDates";`):

```js
import { projectColor } from "@/lib/projectColor";
```

- [ ] **Step 2: Fold project color into eventColor**

Replace lines 36-37:

```js
const eventColor = (item) =>
  item.color || CATEGORY_COLORS[item.category] || TYPE_COLORS[item.type] || "var(--cal-default)";
```

with:

```js
const eventColor = (item) =>
  item.color ||
  (item.projectName && projectColor(item.projectName)) ||
  CATEGORY_COLORS[item.category] ||
  TYPE_COLORS[item.type] ||
  "var(--cal-default)";
```

- [ ] **Step 3: Build a multi-day all-day event for tasks whose span covers more than one day**

Replace the `events` construction at lines 60-73:

```js
  const events = items.map((item) => {
    const spanStartDay = item.spanStart && new Date(item.spanStart).toISOString().slice(0, 10);
    const deadlineDay = item.start && new Date(item.start).toISOString().slice(0, 10);
    const isMultiDay = item.type === "task_deadline" && spanStartDay && deadlineDay && spanStartDay < deadlineDay;

    if (isMultiDay) {
      const todayDay = new Date().toISOString().slice(0, 10);
      const barStartDay = spanStartDay > todayDay ? spanStartDay : todayDay;
      const barEnd = new Date(item.start);
      barEnd.setDate(barEnd.getDate() + 1); // FullCalendar's `end` is exclusive

      return {
        id: `${item.type}:${item.id}`,
        title: item.title,
        start: barStartDay,
        end: barEnd.toISOString().slice(0, 10),
        allDay: true,
        backgroundColor: eventColor(item),
        borderColor: "transparent",
        extendedProps: item,
      };
    }

    return {
      id: `${item.type}:${item.id}`,
      title: item.title,
      // A task's startTime/endTime are "HH:mm" wall-clock values with no
      // timezone of their own — combine them with the deadline's date here,
      // in the browser, so they land on the viewer's own local clock (the
      // server can't do this combination correctly, since it doesn't know
      // the viewer's timezone).
      start: item.startTime ? combineDeadlineAndTime(item.start, item.startTime) : item.start,
      end: item.endTime ? combineDeadlineAndTime(item.start, item.endTime) : item.end || undefined,
      backgroundColor: eventColor(item),
      borderColor: "transparent",
      extendedProps: item,
    };
  });
```

- [ ] **Step 4: Render the label pill and completed styling via eventContent**

Add this function above `export default function CalendarPage()` (after the `eventColor` definition):

```js
const renderEventContent = (arg) => {
  const item = arg.event.extendedProps;
  const done = item.status === "completed";
  return (
    <div className={`flex items-center gap-1 truncate px-1 text-xs ${done ? "line-through opacity-60" : ""}`}>
      {done && <Check size={12} className="shrink-0" />}
      {item.projectName && (
        <span className="shrink-0 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-medium">
          {item.projectName}
        </span>
      )}
      <span className="truncate">{arg.event.title}</span>
    </div>
  );
};
```

Then add the `eventContent` prop to the `<FullCalendar>` element (after `events={events}` at line 130):

```jsx
          events={events}
          eventContent={renderEventContent}
```

- [ ] **Step 5: Manual verification in the browser**

Run: `cd backend && npm run dev` (in one terminal) and `cd frontend && npm run dev` (in another).
Open the calendar page, logged in as the seed admin (`admin@wos.local`, password from `backend/.env`'s `SEED_ADMIN_PASSWORD`).

Create a task (via `/tasks`) with a deadline 4 days out. Confirm on `/calendar`:
- The task renders as one continuous bar spanning today through its deadline day, in the all-day row.
- The bar shows the project name pill and the task title.
- Marking the task `completed` (before its deadline) shows the bar with a checkmark and strikethrough, still in place on the grid — not moved to a separate area.
- Clicking the bar on any day it spans opens the same task (navigates to `/tasks`).

- [ ] **Step 6: Lint and build**

Run: `cd frontend && npm run lint && npm run build`
Expected: both exit 0 with no errors.

- [ ] **Step 7: Commit**

```bash
git add "frontend/app/(app)/calendar/page.js"
git commit -m "feat: render multi-day task spans with project labels and completed styling"
```
