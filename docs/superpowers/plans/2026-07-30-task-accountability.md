# Task Accountability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `client_review` task status exempt from overdue checks, a live one-time overdue point penalty, a Bugs project section with a per-bug point penalty, a derived time-in-status breakdown, and admin-configurable penalty values.

**Architecture:** Bugs are Tasks with a `type` flag (no new collection). Penalties are recorded as `Activity` rows (same mechanism as existing completion tracking) and summed into the existing weekly leaderboard computation. The overdue penalty is detected by a plain `setInterval` sweep (no cron dependency exists or is needed elsewhere in this codebase). Time-in-status is reconstructed on read from the `Activity` log that already records every status change — no new tracking table.

**Tech Stack:** Express 5 + Mongoose (backend, ESM), Next.js 16 + Tailwind v4 (frontend, JS only), no test framework — backend verification is via assert-based axios smoke scripts in `backend/scripts/` run against a live dev server; frontend verification is manual (run `npm run dev`, check in browser).

## Global Constraints

- Spec: `frontend/docs/superpowers/specs/2026-07-30-task-accountability-design.md` — every task below implements one section of it.
- No new dependencies (no cron/scheduler library — use `setInterval`).
- `isTaskOverdue` is deliberately duplicated in `backend/src/utils/taskDates.js` and `frontend/lib/taskDates.js` (backend has no browser to defer timezone handling to) — both copies must change together and stay logically identical.
- Point values are never hardcoded at the call site — always read through `pointsConfig.js`'s cache (`getPointsByPriority()` / `getPenalties()`).
- Penalty `Activity` rows snapshot the affected user ids in `meta.users` at write time — never re-derive "who gets penalized" from a task's *current* assignees when reading the leaderboard later.
- Backend smoke scripts require a running dev server: `cd backend && npm run dev` in one terminal (reads `backend/.env` for `MONGODB_URI`, `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`), then `node --env-file=.env scripts/smoke-<name>.js` in another.
- Frontend has no test framework (`grep -n test frontend/package.json` returns nothing) — frontend tasks are verified by running `cd frontend && npm run dev` and checking the change in a browser, not by an automated suite.

---

## File Structure

**Backend — modified:**
- `backend/src/constants/enums.constants.js` — `client_review` status, `OVERDUE_EXEMPT_STATUSES`.
- `backend/src/constants/points.constants.js` — new penalty seed defaults.
- `backend/src/utils/taskDates.js` — `isTaskOverdue` exemption.
- `backend/src/models/Task.js` — `type`, `reference`, `overduePenaltyApplied`.
- `backend/src/models/LeaderboardConfig.js` — `penalties` sub-schema.
- `backend/src/utils/pointsConfig.js` — `getPenalties()` / `setPenalties()`.
- `backend/src/utils/points.js` — reads `completedLate` penalty from config instead of the hardcoded constant.
- `backend/src/controllers/taskController.js` — bug validation, bug penalty, time-in-status attached to `getTask`.
- `backend/src/controllers/leaderboardController.js` — combined points+penalties config endpoint, leaderboard sums penalty activity, manual sweep-trigger endpoint.
- `backend/src/routes/leaderboardRoutes.js` — new sweep-trigger route.
- `backend/src/server.js` — boots the sweep interval.
- `backend/package.json` — registers the new smoke script in the `smoke` chain.

**Backend — new:**
- `backend/src/services/overdueSweep.js` — `applyOverduePenalties()`.
- `backend/src/utils/statusDurations.js` — `computeStatusDurations(task, activities)`.
- `backend/scripts/smoke-accountability.js` — all new-behavior assertions.

**Frontend — modified:**
- `frontend/lib/taskDates.js` — `isTaskOverdue` exemption (mirrors backend).
- `frontend/components/ui/Badge.jsx` — `bug`, `client_review` tones.
- `frontend/components/tasks/TaskDrawer.jsx` — `client_review` in `STATUSES`, bug reference field, time-in-status section.
- `frontend/app/(app)/tasks/page.js` — `client_review` in `STATUSES`.
- `frontend/app/(app)/tasks/kanban/page.js` — `client_review` in `COLUMNS`.
- `frontend/components/tasks/TaskDialog.jsx` — bug-aware fields.
- `frontend/components/tasks/TaskTable.jsx` — bug badge.
- `frontend/app/(app)/projects/[id]/page.js` — Bugs tab.
- `frontend/app/(app)/admin/leaderboard/page.js` — Penalties section.

---

### Task 1: `client_review` status + overdue exemption

**Files:**
- Modify: `backend/src/constants/enums.constants.js`
- Modify: `backend/src/utils/taskDates.js`
- Modify: `frontend/lib/taskDates.js`
- Modify: `frontend/components/ui/Badge.jsx`
- Modify: `frontend/components/tasks/TaskDrawer.jsx:27`
- Modify: `frontend/app/(app)/tasks/page.js:24`
- Modify: `frontend/app/(app)/tasks/kanban/page.js:22-30` (COLUMNS array)
- Test: `backend/scripts/smoke-accountability.js` (new file, first section)

**Interfaces:**
- Produces: `OVERDUE_EXEMPT_STATUSES` (backend, exported from `enums.constants.js`) = `["completed", "client_review"]`, consumed by Task 5's sweep.
- Produces: `isTaskOverdue(task, now)` unchanged signature, both copies.

- [ ] **Step 1: Write the failing smoke test**

Create `backend/scripts/smoke-accountability.js`:

```js
import assert from "node:assert";
import axios from "axios";

const BASE = process.env.API_URL || "http://localhost:5000/api";
const EMAIL = process.env.SEED_ADMIN_EMAIL;
const PASSWORD = process.env.SEED_ADMIN_PASSWORD;

const authFor = async (email, password) => {
  const login = await axios.post(`${BASE}/auth/login`, { email, password });
  return { headers: { Authorization: `Bearer ${login.data.data.accessToken}` } };
};

const createUser = async (adminAuth, role, extra = {}) => {
  const name = `Smoke ${role} ${Math.random().toString(36).slice(2, 6)}`;
  const email = `${role}+${Date.now()}+${Math.random().toString(36).slice(2)}@wos.local`;
  const password = "smokepass123";
  await axios.post(`${BASE}/users`, { name, email, password, role, ...extra }, adminAuth);
  const login = await axios.post(`${BASE}/auth/login`, { email, password });
  return {
    name,
    userId: login.data.data.user._id,
    auth: { headers: { Authorization: `Bearer ${login.data.data.accessToken}` } },
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const yesterday = () => new Date(Date.now() - 24 * 3600 * 1000);

const run = async () => {
  const adminAuth = await authFor(EMAIL, PASSWORD);
  const manager = await createUser(adminAuth, "manager");
  const member = await createUser(adminAuth, "member", { reportingManager: manager.userId });

  const project = await axios.post(
    `${BASE}/projects`,
    { name: `Smoke Accountability ${Date.now()}`, manager: manager.userId, members: [member.userId] },
    manager.auth
  );
  const projectId = project.data.data.project._id;

  // --- Task 1: client_review is exempt from the overdue tag ---

  const overdueTask = await axios.post(
    `${BASE}/tasks`,
    {
      project: projectId,
      title: "Client review exemption task",
      assignees: [member.userId],
      priority: "medium",
      deadline: yesterday(),
      status: "client_review",
    },
    manager.auth
  );
  const overdueTaskId = overdueTask.data.data.task._id;

  const dashWhileReview = await axios.get(`${BASE}/dashboard`, manager.auth);
  assert.ok(
    !dashWhileReview.data.data.overdueTasks.some((t) => t._id === overdueTaskId),
    "a task in client_review, even past its deadline, is not counted as overdue"
  );

  await axios.patch(`${BASE}/tasks/${overdueTaskId}`, { status: "in_progress" }, manager.auth);
  const dashAfterMove = await axios.get(`${BASE}/dashboard`, manager.auth);
  assert.ok(
    dashAfterMove.data.data.overdueTasks.some((t) => t._id === overdueTaskId),
    "moving the same task out of client_review while still past deadline makes it overdue again"
  );

  console.log("smoke-accountability: all checks passed");
};

run().catch((error) => {
  console.error("smoke-accountability failed:", error.response?.data?.message || error.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Terminal A: `cd backend && npm run dev`
Terminal B: `cd backend && node --env-file=.env scripts/smoke-accountability.js`
Expected: FAIL — either a 400 on task creation (`status` not in the current `TASK_STATUSES` enum) or the first assertion fails because the task shows up as overdue.

- [ ] **Step 3: Add the status + exemption list (backend)**

In `backend/src/constants/enums.constants.js`, change:

```js
export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "testing",
  "completed",
  "blocked",
];
```

to:

```js
export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "testing",
  "client_review",
  "completed",
  "blocked",
];

// A task in any of these statuses is never "overdue" — completed work is
// done, and client_review means the ball is in the client's court, not ours.
export const OVERDUE_EXEMPT_STATUSES = ["completed", "client_review"];
```

- [ ] **Step 4: Update `isTaskOverdue` (backend)**

In `backend/src/utils/taskDates.js`, add the import and change the early-return:

```js
import { OVERDUE_EXEMPT_STATUSES } from "../constants/enums.constants.js";
```

```js
export const isTaskOverdue = (task, now = new Date()) => {
  if (!task.deadline || OVERDUE_EXEMPT_STATUSES.includes(task.status)) return false;
  const cutoff = task.endTime ? combineDeadlineAndTime(task.deadline, task.endTime) : endOfDayLocal(task.deadline);
  return cutoff < now;
};
```

- [ ] **Step 5: Run the smoke test again to verify it passes**

`node --env-file=.env scripts/smoke-accountability.js`
Expected: PASS — both assertions in the "client_review is exempt" section succeed.

- [ ] **Step 6: Mirror into the frontend and update UI surfaces**

In `frontend/lib/taskDates.js`, add near the top:

```js
const OVERDUE_EXEMPT_STATUSES = ["completed", "client_review"];
```

and change:

```js
export const isTaskOverdue = (task, now = new Date()) => {
  if (!task.deadline || OVERDUE_EXEMPT_STATUSES.includes(task.status)) return false;
  const cutoff = task.endTime ? combineDeadlineAndTime(task.deadline, task.endTime) : endOfDayLocal(task.deadline);
  return cutoff < now;
};
```

In `frontend/components/ui/Badge.jsx`, add to `VALUE_TONES` (next to the other task-status entries):

```js
  client_review: "warning",
```

and add to the top of the same object (bug's tone, used by Task 8):

```js
  bug: "danger",
```

In `frontend/components/tasks/TaskDrawer.jsx:27`, change:

```js
const STATUSES = ["backlog", "todo", "in_progress", "review", "testing", "completed", "blocked"];
```
to:
```js
const STATUSES = ["backlog", "todo", "in_progress", "review", "testing", "client_review", "completed", "blocked"];
```

In `frontend/app/(app)/tasks/page.js:24`, apply the identical change to its own `STATUSES` array.

In `frontend/app/(app)/tasks/kanban/page.js`, find the `COLUMNS` array (starts at line 22) and insert a `["client_review", "Client review"]` entry in the same sequential position (after `["testing", "Testing"]`, before `["completed", "Completed"]`).

- [ ] **Step 7: Manually verify the frontend**

`cd frontend && npm run dev`, open a project's Tasks tab, open a task in the drawer: confirm "Client review" appears as a status option and renders with a yellow/warning badge when selected. Open `/tasks/kanban`: confirm a "Client review" column appears between "Testing" and "Completed".

- [ ] **Step 8: Commit**

```bash
cd backend && git add src/constants/enums.constants.js src/utils/taskDates.js scripts/smoke-accountability.js
git commit -m "Add client_review task status, exempt from overdue checks"
cd ../frontend && git add lib/taskDates.js components/ui/Badge.jsx components/tasks/TaskDrawer.jsx "app/(app)/tasks/page.js" "app/(app)/tasks/kanban/page.js"
git commit -m "Add client_review task status, exempt from overdue checks"
```

---

### Task 2: Configurable penalties — model, cache, and the existing completed-late penalty

**Files:**
- Modify: `backend/src/models/LeaderboardConfig.js`
- Modify: `backend/src/constants/points.constants.js`
- Modify: `backend/src/utils/pointsConfig.js`
- Modify: `backend/src/utils/points.js`
- Test: `backend/scripts/smoke-accountability.js` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces: `getPenalties(): { completedLate: number, overdue: number, bug: number }` and `setPenalties(values): Promise<Penalties>` from `pointsConfig.js`, consumed by Task 3 (admin endpoint), Task 4 (bug penalty), Task 5 (overdue sweep), Task 6 (leaderboard is unaffected here but reads the same `Activity` rows those tasks write).

- [ ] **Step 1: Write the failing smoke test**

Append to `backend/scripts/smoke-accountability.js`, before `console.log("smoke-accountability: all checks passed");`:

```js
  // --- Task 2: penalties are part of the points config, with correct defaults ---

  const configBefore = await axios.get(`${BASE}/leaderboard/points-config`, member.auth);
  assert.deepEqual(
    configBefore.data.data.penalties,
    { completedLate: 5, overdue: 2, bug: 1 },
    "default penalty values match the spec"
  );
```

- [ ] **Step 2: Run it to verify it fails**

`node --env-file=.env scripts/smoke-accountability.js`
Expected: FAIL — `configBefore.data.data.penalties` is `undefined`.

- [ ] **Step 3: Extend the model**

In `backend/src/models/LeaderboardConfig.js`, replace the file with:

```js
import mongoose from "mongoose";

// Singleton: exactly one document holds the admin-editable point values.
const leaderboardConfigSchema = new mongoose.Schema(
  {
    pointsByPriority: {
      low: { type: Number, required: true },
      medium: { type: Number, required: true },
      high: { type: Number, required: true },
      critical: { type: Number, required: true },
    },
    penalties: {
      completedLate: { type: Number, required: true },
      overdue: { type: Number, required: true },
      bug: { type: Number, required: true },
    },
  },
  { timestamps: true }
);

export default mongoose.model("LeaderboardConfig", leaderboardConfigSchema);
```

- [ ] **Step 4: Add the new constants**

In `backend/src/constants/points.constants.js`, replace:

```js
export const OVERDUE_PENALTY = 5;
```

with:

```js
export const PENALTIES = { completedLate: 5, overdue: 2, bug: 1 };
```

(`OVERDUE_PENALTY` is fully retired here, not left as dead code — Step 6 removes its one remaining import/use in `points.js`, and `PENALTIES.completedLate` carries the same default value forward as the new single source of truth.)

- [ ] **Step 5: Extend `pointsConfig.js`**

Replace `backend/src/utils/pointsConfig.js` with:

```js
import LeaderboardConfig from "../models/LeaderboardConfig.js";
import { POINTS_BY_PRIORITY as DEFAULT_POINTS, PENALTIES as DEFAULT_PENALTIES } from "../constants/points.constants.js";

// In-memory cache so points.js can stay synchronous — refreshed on boot and
// on every admin update. Small/rare writes, so no cache-invalidation edge cases.
let currentPoints = { ...DEFAULT_POINTS };
let currentPenalties = { ...DEFAULT_PENALTIES };

export const getPointsByPriority = () => currentPoints;
export const getPenalties = () => currentPenalties;

export const loadPointsConfig = async () => {
  const doc = await LeaderboardConfig.findOne();
  if (doc) {
    const obj = doc.toObject();
    currentPoints = { ...DEFAULT_POINTS, ...obj.pointsByPriority };
    currentPenalties = { ...DEFAULT_PENALTIES, ...obj.penalties };
  }
};

export const setPointsByPriority = async (values) => {
  const next = { ...values };
  await LeaderboardConfig.findOneAndUpdate(
    {},
    { pointsByPriority: next, penalties: currentPenalties },
    { upsert: true, runValidators: true }
  );
  currentPoints = next;
  return currentPoints;
};

export const setPenalties = async (values) => {
  const next = { ...values };
  await LeaderboardConfig.findOneAndUpdate(
    {},
    { pointsByPriority: currentPoints, penalties: next },
    { upsert: true, runValidators: true }
  );
  currentPenalties = next;
  return currentPenalties;
};
```

(Both setters write the full document — `pointsByPriority` and `penalties` are both `required` on the schema, so a partial upsert would fail validation the first time either is written before the other exists.)

- [ ] **Step 6: Read the completed-late penalty from config**

In `backend/src/utils/points.js`, remove the `OVERDUE_PENALTY` import and change:

```js
import { AUTO_AWARD_RATIO, OVERDUE_PENALTY } from "../constants/points.constants.js";
import { getPointsByPriority } from "./pointsConfig.js";
```

to:

```js
import { AUTO_AWARD_RATIO } from "../constants/points.constants.js";
import { getPointsByPriority, getPenalties } from "./pointsConfig.js";
```

and change:

```js
  const penalty = wasCompletedLate(task, completedAt) ? OVERDUE_PENALTY : 0;
```

to:

```js
  const penalty = wasCompletedLate(task, completedAt) ? getPenalties().completedLate : 0;
```

- [ ] **Step 7: Run the smoke test again to verify it passes**

`node --env-file=.env scripts/smoke-accountability.js`
Expected: PASS. (The dev server needs a restart if it isn't running under `--watch` — check `backend/package.json`'s `dev` script, which already uses `node --watch`, so it reloads automatically.)

- [ ] **Step 8: Run the full existing smoke suite to confirm no regression**

`cd backend && npm run smoke`
Expected: PASS — `smoke-leaderboard.js`'s late-completion-penalty assertion (`11 (auto) - 5 (overdue) = 6`) still holds, since `getPenalties().completedLate` defaults to `5`, matching the old hardcoded constant.

- [ ] **Step 9: Commit**

```bash
git add src/models/LeaderboardConfig.js src/constants/points.constants.js src/utils/pointsConfig.js src/utils/points.js scripts/smoke-accountability.js
git commit -m "Move completed-late penalty into admin-configurable LeaderboardConfig"
```

---

### Task 3: Admin settings UI for all three penalties

**Files:**
- Modify: `backend/src/controllers/leaderboardController.js`
- Modify: `frontend/app/(app)/admin/leaderboard/page.js`
- Test: `backend/scripts/smoke-accountability.js` (append)

**Interfaces:**
- Consumes: `getPenalties()` / `setPenalties()` from Task 2.
- Produces: `GET /leaderboard/points-config` now returns `{ pointsByPriority: {...}, penalties: {...} }`; `PUT /leaderboard/points-config` accepts the same combined shape.

- [ ] **Step 1: Write the failing smoke test**

Append to `backend/scripts/smoke-accountability.js`:

```js
  // --- Task 3: admins can update penalties; validation matches the priority-points pattern ---

  const badPenalty = await axios.put(
    `${BASE}/leaderboard/points-config`,
    { pointsByPriority: configBefore.data.data.pointsByPriority, penalties: { completedLate: -1, overdue: 2, bug: 1 } },
    { ...adminAuth, validateStatus: () => true }
  );
  assert.equal(badPenalty.status, 400, "a negative penalty value is rejected");

  const memberPut = await axios.put(
    `${BASE}/leaderboard/points-config`,
    { pointsByPriority: configBefore.data.data.pointsByPriority, penalties: { completedLate: 9, overdue: 2, bug: 1 } },
    { ...member.auth, validateStatus: () => true }
  );
  assert.equal(memberPut.status, 403, "only admins can change penalty values");

  try {
    const goodPut = await axios.put(
      `${BASE}/leaderboard/points-config`,
      { pointsByPriority: configBefore.data.data.pointsByPriority, penalties: { completedLate: 9, overdue: 3, bug: 2 } },
      adminAuth
    );
    assert.equal(goodPut.status, 200);
    assert.deepEqual(goodPut.data.data.penalties, { completedLate: 9, overdue: 3, bug: 2 }, "updated penalties echoed back");
  } finally {
    const restore = await axios.put(
      `${BASE}/leaderboard/points-config`,
      { pointsByPriority: configBefore.data.data.pointsByPriority, penalties: configBefore.data.data.penalties },
      adminAuth
    );
    assert.equal(restore.status, 200, "points/penalties config restore succeeded");
  }
```

- [ ] **Step 2: Run it to verify it fails**

`node --env-file=.env scripts/smoke-accountability.js`
Expected: FAIL — `updatePointsConfig` currently 400s on receiving `{ pointsByPriority, penalties }` (it destructures `low/medium/high/critical` directly off `req.body`, which won't exist at the top level).

- [ ] **Step 3: Rewrite the controller endpoints**

In `backend/src/controllers/leaderboardController.js`, change the imports:

```js
import { getPointsByPriority, setPointsByPriority, getPenalties, setPenalties } from "../utils/pointsConfig.js";
```

and replace `getPointsConfig`/`updatePointsConfig` with:

```js
export const getPointsConfig = async (req, res) => {
  return res.json({
    success: true,
    message: "Points config fetched",
    data: { pointsByPriority: getPointsByPriority(), penalties: getPenalties() },
  });
};

const validateNonNegative = (values, label) => {
  for (const [key, val] of Object.entries(values)) {
    if (typeof val !== "number" || !Number.isFinite(val) || val < 0) {
      return `${label}.${key} must be a non-negative number`;
    }
  }
  return null;
};

export const updatePointsConfig = async (req, res) => {
  try {
    const { pointsByPriority, penalties } = req.body;
    const pointsError = pointsByPriority && validateNonNegative(pointsByPriority, "pointsByPriority");
    if (pointsError) return res.status(400).json({ success: false, message: pointsError });
    const penaltiesError = penalties && validateNonNegative(penalties, "penalties");
    if (penaltiesError) return res.status(400).json({ success: false, message: penaltiesError });

    const updatedPoints = pointsByPriority ? await setPointsByPriority(pointsByPriority) : getPointsByPriority();
    const updatedPenalties = penalties ? await setPenalties(penalties) : getPenalties();

    return res.json({
      success: true,
      message: "Points config updated",
      data: { pointsByPriority: updatedPoints, penalties: updatedPenalties },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
```

- [ ] **Step 4: Run the smoke test again to verify it passes**

`node --env-file=.env scripts/smoke-accountability.js`
Expected: PASS.

- [ ] **Step 5: Update the existing leaderboard smoke assertions for the new response shape**

In `backend/scripts/smoke-leaderboard.js`, every place reading `original.data.data` / `defaults` / `goodPut.data.data.low` as a flat priority object now needs the `pointsByPriority` wrapper. Change:

```js
  const original = await axios.get(`${BASE}/leaderboard/points-config`, member.auth);
  assert.equal(original.status, 200, "any authenticated user can read the point config");
  const defaults = original.data.data;
```
to:
```js
  const original = await axios.get(`${BASE}/leaderboard/points-config`, member.auth);
  assert.equal(original.status, 200, "any authenticated user can read the point config");
  const defaults = original.data.data.pointsByPriority;
```

and every subsequent `{ ...defaults, low: 50 }` payload to `{ pointsByPriority: { ...defaults, low: 50 } }`, and every `goodPut.data.data.low` / `restore.data.data` read to `goodPut.data.data.pointsByPriority.low` / `restore.data.data.pointsByPriority`. Apply the same wrapper change to all four call sites in that file (`memberPut`, `badPut`, `goodPut`, the final `restore`).

- [ ] **Step 6: Run the full smoke suite**

`npm run smoke`
Expected: PASS.

- [ ] **Step 7: Update the frontend service and admin page**

`frontend/services/leaderboardService.js` needs no change — `fetchPointsConfig`/`updatePointsConfig` already pass the response/request body through opaquely.

Replace `frontend/app/(app)/admin/leaderboard/page.js` with:

```jsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Trophy, AlertTriangle } from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Input, Button } from "@/components/ui/Field";
import { fetchPointsConfig, updatePointsConfig } from "@/services/leaderboardService";
import { useAuthStore } from "@/store/authStore";

const PRIORITIES = ["low", "medium", "high", "critical"];
const PENALTY_FIELDS = [
  ["completedLate", "Completed late"],
  ["overdue", "Went overdue (still open)"],
  ["bug", "Bug logged"],
];

export default function AdminLeaderboardPage() {
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === "admin";
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["points-config"],
    queryFn: fetchPointsConfig,
    enabled: isAdmin,
  });

  const effective = draft ?? data;

  const mutation = useMutation({
    mutationFn: updatePointsConfig,
    onSuccess: (updated) => {
      queryClient.setQueryData(["points-config"], updated);
      setDraft(null);
      setFeedback({ ok: true, message: "Point values updated." });
    },
    onError: (e) => setFeedback({ ok: false, message: e.response?.data?.message || "Something went wrong" }),
  });

  if (!isAdmin) {
    return (
      <EmptyState icon={ShieldAlert} heading="Admins only" description="This section is restricted to admins." />
    );
  }

  if (isLoading || !effective) {
    return <Skeleton className="h-64 w-full rounded-card" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <form
        className="space-y-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setFeedback(null);
          mutation.mutate({
            pointsByPriority: Object.fromEntries(PRIORITIES.map((p) => [p, Number(effective.pointsByPriority[p])])),
            penalties: Object.fromEntries(
              PENALTY_FIELDS.map(([key]) => [key, Number(effective.penalties[key])])
            ),
          });
        }}
      >
        {feedback && (
          <p
            role={feedback.ok ? "status" : "alert"}
            className={`rounded-input border px-3 py-2 text-sm ${
              feedback.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"
            }`}
          >
            {feedback.message}
          </p>
        )}

        <section className="rounded-card border border-border bg-surface p-6">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-warning" />
            <h3 className="text-base font-semibold tracking-tight">Leaderboard points</h3>
          </div>
          <p className="mt-1 text-sm text-muted">
            Points awarded per task priority when marked completed. Changes apply to future completions.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {PRIORITIES.map((p) => (
              <Input
                key={p}
                label={p[0].toUpperCase() + p.slice(1)}
                type="number"
                min="0"
                step="1"
                value={effective.pointsByPriority[p]}
                onChange={(e) =>
                  setDraft({
                    ...effective,
                    pointsByPriority: { ...effective.pointsByPriority, [p]: e.target.value },
                  })
                }
              />
            ))}
          </div>
        </section>

        <section className="rounded-card border border-border bg-surface p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-danger" />
            <h3 className="text-base font-semibold tracking-tight">Penalties</h3>
          </div>
          <p className="mt-1 text-sm text-muted">
            Points deducted for each accountability event. The overdue penalty fires once, live, the moment a
            task's deadline passes while still open; the bug penalty fires once, the moment a bug is logged.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {PENALTY_FIELDS.map(([key, label]) => (
              <Input
                key={key}
                label={label}
                type="number"
                min="0"
                step="1"
                value={effective.penalties[key]}
                onChange={(e) =>
                  setDraft({ ...effective, penalties: { ...effective.penalties, [key]: e.target.value } })
                }
              />
            ))}
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 8: Manually verify**

`cd frontend && npm run dev`, log in as admin, go to `/admin/leaderboard`: confirm both sections render with correct defaults (5/2/1), change a penalty value, save, reload, confirm it persisted.

- [ ] **Step 9: Commit**

```bash
cd backend && git add src/controllers/leaderboardController.js scripts/smoke-accountability.js scripts/smoke-leaderboard.js
git commit -m "Expose penalties in the points-config endpoint"
cd ../frontend && git add "app/(app)/admin/leaderboard/page.js"
git commit -m "Add Penalties section to admin leaderboard settings"
```

---

### Task 4: Bugs — Task model fields, creation validation, and the 1-pt penalty

**Files:**
- Modify: `backend/src/models/Task.js`
- Modify: `backend/src/controllers/taskController.js`
- Test: `backend/scripts/smoke-accountability.js` (append)

**Interfaces:**
- Consumes: `getPenalties().bug` (Task 2).
- Produces: `Task.type` (`"task" | "bug"`), `Task.reference` (string), both in `FULL_FIELDS`. An `Activity` row with `action: "bug_logged"`, `meta: { title, points: -bugPenalty, users: [assigneeIds] }` per bug creation — consumed by Task 6.

- [ ] **Step 1: Write the failing smoke test**

Append to `backend/scripts/smoke-accountability.js`:

```js
  // --- Task 4: bugs require at least one module, and log a penalty activity ---

  const bugNoModule = await axios.post(
    `${BASE}/tasks`,
    { project: projectId, title: "Bug with no module", type: "bug", assignees: [member.userId], priority: "high" },
    { ...manager.auth, validateStatus: () => true }
  );
  assert.equal(bugNoModule.status, 400, "a bug with no modules is rejected");

  const projectModule = await axios.post(
    `${BASE}/projects/${projectId}/modules`,
    { name: `Smoke Module ${Date.now()}` },
    manager.auth
  );
  const moduleId = projectModule.data.data.module._id;

  const bug = await axios.post(
    `${BASE}/tasks`,
    {
      project: projectId,
      title: "Real bug",
      type: "bug",
      reference: "Found while testing checkout",
      modules: [moduleId],
      assignees: [member.userId],
      priority: "medium",
    },
    manager.auth
  );
  assert.equal(bug.status, 201);
  assert.equal(bug.data.data.task.type, "bug", "the created task is marked as a bug");
  assert.equal(bug.data.data.task.reference, "Found while testing checkout");
```

- [ ] **Step 2: Run it to verify it fails**

`node --env-file=.env scripts/smoke-accountability.js`
Expected: FAIL — the current `createTask` accepts any `type`/`reference` in the body silently (they're not destructured, so they're dropped) and never rejects a moduleless bug, so `bugNoModule.status` is `201`, not `400`.

(Check the actual module-creation route name/shape first — run `grep -n "router\.\(post\|get\)" backend/src/routes/moduleRoutes.js` if `POST /projects/:id/modules` 404s, and adjust the smoke test's module-creation call to match; this plan assumes the same route shape used by `ModuleDialog.jsx` on the frontend.)

- [ ] **Step 3: Extend the Task model**

In `backend/src/models/Task.js`, add three fields to `taskSchema` (after `recurrence`):

```js
    // "bug" reuses every Task mechanic (assignment, status flow, comments,
    // kanban, points) — see 2026-07-30-task-accountability-design.md.
    type: { type: String, enum: ["task", "bug"], default: "task" },
    reference: { type: String, default: "" },
    // Guards the one-time overdue-penalty sweep (services/overdueSweep.js)
    // from double-deducting the same task.
    overduePenaltyApplied: { type: Boolean, default: false },
```

- [ ] **Step 4: Wire validation and the penalty into `createTask`**

In `backend/src/controllers/taskController.js`, add to the imports:

```js
import { getPenalties } from "../utils/pointsConfig.js";
```

Add `"type", "reference"` to the `FULL_FIELDS` array (after `"recurrence"`).

In `createTask`, destructure `type` and `reference` alongside the existing fields:

```js
    const {
      project: projectId,
      modules,
      title,
      description,
      assignees,
      priority,
      status,
      estimatedHours,
      deadline,
      startTime,
      endTime,
      labels,
      blockedBy,
      recurrence,
      type,
      reference,
    } = req.body;
```

Immediately after the existing per-module `ProjectModule.findOne` validation loop (right before the `isMember` line), add:

```js
    if (type === "bug" && !(modules || []).length) {
      return res.status(400).json({ success: false, message: "Bugs must be tagged to at least one module" });
    }
```

In the `Task.create({...})` call, add `type: type || "task", reference: reference || "",` (next to `labels: labels || [],`).

After the `task` is created and *after* the existing `if (isMember) {...} else {...}` activity/notify block (so both approval-required and direct-create paths get it), add:

```js
    if (task.type === "bug") {
      const bugPenalty = getPenalties().bug;
      recordActivity({
        actor: req.user._id,
        action: "bug_logged",
        entityType: "task",
        entityId: task._id,
        project: project._id,
        meta: { title: task.title, points: -bugPenalty, users: task.assignees.map(String) },
      });
      for (const userId of task.assignees) {
        notify({
          user: userId,
          type: "points_awarded",
          title: `-${bugPenalty} pts: bug logged — "${task.title}"`,
          link: `/tasks/${task._id}`,
        });
      }
    }
```

- [ ] **Step 5: Enforce the same rule on edits**

In `updateTask`, right after the existing per-module validation loop (before `const prevAssignees = ...`), add:

```js
    const resultingType = "type" in req.body ? req.body.type : task.type;
    const resultingModules = "modules" in req.body ? req.body.modules : task.modules;
    if (resultingType === "bug" && !(resultingModules || []).length) {
      return res.status(400).json({ success: false, message: "Bugs must be tagged to at least one module" });
    }
```

(No penalty is applied here — the bug penalty only fires once, at creation, per the spec's design decision. Editing an existing task's `type` to `"bug"` later does not retroactively penalize.)

- [ ] **Step 6: Run the smoke test again to verify it passes**

`node --env-file=.env scripts/smoke-accountability.js`
Expected: PASS.

- [ ] **Step 7: Run the full smoke suite**

`npm run smoke`
Expected: PASS — `smoke-tasks-extra.js` and others create tasks without `type`, which now defaults to `"task"`, so no existing behavior changes.

- [ ] **Step 8: Commit**

```bash
git add src/models/Task.js src/controllers/taskController.js scripts/smoke-accountability.js
git commit -m "Add bug task type with mandatory modules and a one-time bug penalty"
```

---

### Task 5: Overdue sweep — one-time 2-pt live penalty

**Files:**
- Modify: `backend/src/models/Activity.js`
- Create: `backend/src/services/overdueSweep.js`
- Modify: `backend/src/server.js`
- Modify: `backend/src/controllers/leaderboardController.js`
- Modify: `backend/src/routes/leaderboardRoutes.js`
- Test: `backend/scripts/smoke-accountability.js` (append)

**Interfaces:**
- Consumes: `OVERDUE_EXEMPT_STATUSES` (Task 1), `getPenalties().overdue` (Task 2), `combineDeadlineAndTime`/`endOfDayLocal` (existing `utils/taskDates.js`).
- Produces: `applyOverduePenalties(): Promise<{ processed: number }>`, exported for `server.js`'s interval and the new manual-trigger endpoint. Writes `Activity` rows with `action: "overdue_penalized"`, same `meta` shape as `bug_logged` — consumed by Task 6.

- [ ] **Step 1: Write the failing smoke test**

Append to `backend/scripts/smoke-accountability.js`:

```js
  // --- Task 5: the overdue sweep penalizes an open, past-deadline task exactly once ---

  const overdueOpenTask = await axios.post(
    `${BASE}/tasks`,
    {
      project: projectId,
      title: "Still-open overdue task",
      assignees: [member.userId],
      priority: "medium",
      deadline: yesterday(),
    },
    manager.auth
  );
  const overdueOpenTaskId = overdueOpenTask.data.data.task._id;

  const sweep1 = await axios.post(`${BASE}/leaderboard/run-overdue-sweep`, {}, adminAuth);
  assert.equal(sweep1.status, 200);
  assert.ok(sweep1.data.data.processed >= 1, "the sweep processes at least the one overdue task just created");

  const sweep2 = await axios.post(`${BASE}/leaderboard/run-overdue-sweep`, {}, adminAuth);
  assert.equal(sweep2.data.data.processed, 0, "a second sweep immediately after finds nothing new to penalize");

  const memberSweep = await axios.post(
    `${BASE}/leaderboard/run-overdue-sweep`,
    {},
    { ...member.auth, validateStatus: () => true }
  );
  assert.equal(memberSweep.status, 403, "only admins can trigger the sweep");
```

- [ ] **Step 2: Run it to verify it fails**

`node --env-file=.env scripts/smoke-accountability.js`
Expected: FAIL — `POST /leaderboard/run-overdue-sweep` doesn't exist yet (404).

- [ ] **Step 3: Allow system-triggered activities with no human actor**

`backend/src/models/Activity.js`'s `actor` field is currently `required: true`, but the sweep is triggered by a `setInterval`, not a request from a logged-in user — there's no `req.user._id` to attribute it to. `ActivityFeed.jsx:25` already renders `a.actor?.name || "Someone"`, so a null actor is already handled safely on the display side. Change:

```js
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
```
to:
```js
    // Most activity is attributed to the acting user. A few are system-
    // triggered (e.g. the overdue-penalty sweep in services/overdueSweep.js)
    // and have no human actor — ActivityFeed.jsx already renders these as
    // "Someone".
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
```

- [ ] **Step 4: Write the sweep service**

Create `backend/src/services/overdueSweep.js`:

```js
import Task from "../models/Task.js";
import { OVERDUE_EXEMPT_STATUSES } from "../constants/enums.constants.js";
import { combineDeadlineAndTime, endOfDayLocal } from "../utils/taskDates.js";
import { getPenalties } from "../utils/pointsConfig.js";
import { recordActivity, notify } from "../utils/record.js";

// Live, one-time "went overdue while still open" penalty — distinct from
// the completed-late penalty in utils/points.js, which only fires once a
// task is eventually finished. See 2026-07-30-task-accountability-design.md.
export const applyOverduePenalties = async (now = new Date()) => {
  const candidates = await Task.find({
    deadline: { $ne: null },
    status: { $nin: OVERDUE_EXEMPT_STATUSES },
    overduePenaltyApplied: false,
  });

  const overduePenalty = getPenalties().overdue;
  let processed = 0;

  for (const task of candidates) {
    const cutoff = task.endTime ? combineDeadlineAndTime(task.deadline, task.endTime) : endOfDayLocal(task.deadline);
    if (cutoff >= now) continue;

    task.overduePenaltyApplied = true;
    await task.save();

    recordActivity({
      actor: null,
      action: "overdue_penalized",
      entityType: "task",
      entityId: task._id,
      project: task.project,
      meta: { title: task.title, points: -overduePenalty, users: task.assignees.map(String) },
    });
    for (const userId of task.assignees) {
      notify({
        user: userId,
        type: "points_awarded",
        title: `-${overduePenalty} pts: "${task.title}" went overdue`,
        link: `/tasks/${task._id}`,
      });
    }
    processed += 1;
  }

  return { processed };
};
```

(`actor: null` is safe now that Step 3 relaxed the `Activity` schema — `recordActivity` is fire-and-forget and swallows errors via `.catch(console.error)`, so a validation failure here would have silently dropped every sweep activity without failing any test loudly.)

- [ ] **Step 5: Add the manual-trigger endpoint**

In `backend/src/controllers/leaderboardController.js`, add the import:

```js
import { applyOverduePenalties } from "../services/overdueSweep.js";
```

and a new export:

```js
export const runOverdueSweep = async (req, res) => {
  try {
    const result = await applyOverduePenalties();
    return res.json({ success: true, message: "Overdue sweep completed", data: result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
```

In `backend/src/routes/leaderboardRoutes.js`, add the import and route:

```js
import { getLeaderboard, getPointsConfig, updatePointsConfig, runOverdueSweep } from "../controllers/leaderboardController.js";
```
```js
router.post("/run-overdue-sweep", authorize("admin"), runOverdueSweep);
```

- [ ] **Step 6: Wire the periodic sweep into boot**

In `backend/src/server.js`, add the import:

```js
import { applyOverduePenalties } from "./services/overdueSweep.js";
```

and after `await loadPointsConfig();`, add:

```js
    await applyOverduePenalties();
    setInterval(() => {
      applyOverduePenalties().catch((error) => console.error("overdue sweep failed:", error.message));
    }, 2 * 60 * 1000);
```

- [ ] **Step 7: Run the smoke test again to verify it passes**

`node --env-file=.env scripts/smoke-accountability.js`
Expected: PASS.

- [ ] **Step 8: Run the full smoke suite**

`npm run smoke`
Expected: PASS.

- [ ] **Step 9: Register the new script in the smoke chain**

In `backend/package.json`'s `smoke` script, append ` && node --env-file=.env scripts/smoke-accountability.js` to the end of the existing chain.

- [ ] **Step 10: Commit**

```bash
git add src/models/Activity.js src/services/overdueSweep.js src/server.js src/controllers/leaderboardController.js src/routes/leaderboardRoutes.js scripts/smoke-accountability.js package.json
git commit -m "Add one-time overdue penalty sweep"
```

---

### Task 6: Leaderboard sums penalty activities

**Files:**
- Modify: `backend/src/controllers/leaderboardController.js`
- Test: `backend/scripts/smoke-accountability.js` (append)

**Interfaces:**
- Consumes: `bug_logged`/`overdue_penalized` `Activity` rows (Tasks 4, 5), each with `meta.points` (negative number) and `meta.users` (array of id strings).
- Produces: `getLeaderboard`'s existing `rows[].points` now nets penalties in; may go negative.

- [ ] **Step 1: Write the failing smoke test**

Append to `backend/scripts/smoke-accountability.js`. This computes an exact expected total, so it must run after all of the section-4/5 activity above landed for `member`:

```js
  // --- Task 6: the leaderboard nets bug + overdue penalties against completed-task points ---

  await sleep(400); // let the fire-and-forget Activity writes above land

  const csv = await axios.get(`${BASE}/leaderboard?week=${new Date().toISOString().slice(0, 10)}&format=csv`, manager.auth);
  const row = csv.data
    .trim()
    .split("\n")
    .slice(1)
    .find((line) => line.includes(member.name));
  assert.ok(row, "member appears in the export after accruing penalties");
  const penaltyPoints = Number(row.split(",").pop());
  // member has accrued exactly: -1 (bug_logged) + -2 (overdue_penalized), no completions yet this run
  assert.equal(penaltyPoints, -3, "bug and overdue penalties net together correctly, going negative");
```

- [ ] **Step 2: Run it to verify it fails**

`node --env-file=.env scripts/smoke-accountability.js`
Expected: FAIL — `member`'s points currently show `0` (penalty activities aren't read at all yet).

- [ ] **Step 3: Extend `getLeaderboard`**

In `backend/src/controllers/leaderboardController.js`, right after the existing block that builds `pointsByUser`/`tasksByUser` from `latestByTask` (ends around the `for (const assigneeId of task.assignees) {...}` loop), add:

```js
    const penaltyActivities = await Activity.find({
      entityType: "task",
      action: { $in: ["overdue_penalized", "bug_logged"] },
      createdAt: { $gte: weekStart, $lte: weekEnd },
    }).select("meta");

    for (const activity of penaltyActivities) {
      for (const userId of activity.meta?.users || []) {
        pointsByUser.set(userId, (pointsByUser.get(userId) || 0) + (activity.meta.points || 0));
      }
    }
```

(`tasksByUser`/`tasksCompleted` is intentionally untouched — penalties don't count as completed tasks. `unranked`'s `points: pointsByUser.get(String(u._id)) || 0` line already handles negative values correctly since it's a plain numeric default, not a `Math.max(0, ...)` clamp.)

- [ ] **Step 4: Run the smoke test again to verify it passes**

`node --env-file=.env scripts/smoke-accountability.js`
Expected: PASS.

- [ ] **Step 5: Run the full smoke suite**

`npm run smoke`
Expected: PASS — `smoke-leaderboard.js`'s exact point-sum assertions (e.g. `32`) are unaffected since that test's tasks are all `type: "task"` (never bugs) and none go overdue-while-open (they're completed immediately in the same test).

- [ ] **Step 6: Commit**

```bash
git add src/controllers/leaderboardController.js scripts/smoke-accountability.js
git commit -m "Net bug and overdue penalties into the weekly leaderboard"
```

---

### Task 7: Time-in-status breakdown

**Files:**
- Create: `backend/src/utils/statusDurations.js`
- Modify: `backend/src/controllers/taskController.js`
- Test: `backend/scripts/smoke-accountability.js` (append)

**Interfaces:**
- Consumes: `Activity` rows for a task (`entityType: "task"`, `entityId`, `meta.statusFrom`/`meta.statusTo`, `createdAt`) already written by `updateTask` on every status change.
- Produces: `computeStatusDurations(task, activities): { durationsMs: Record<string, number>, totalWorkingMs: number }`. `GET /tasks/:id` response gains `task.statusDurations` and `task.totalWorkingMs`.

- [ ] **Step 1: Write the failing smoke test**

Append to `backend/scripts/smoke-accountability.js`:

```js
  // --- Task 7: time-in-status is reconstructed from the status-change activity log ---

  const timedTask = await axios.post(
    `${BASE}/tasks`,
    { project: projectId, title: "Timed task", assignees: [member.userId], priority: "low" },
    manager.auth
  );
  const timedTaskId = timedTask.data.data.task._id;

  await axios.patch(`${BASE}/tasks/${timedTaskId}`, { status: "in_progress" }, member.auth);
  await sleep(1000);
  await axios.patch(`${BASE}/tasks/${timedTaskId}`, { status: "review" }, member.auth);
  await sleep(500);
  await axios.patch(`${BASE}/tasks/${timedTaskId}`, { status: "completed" }, member.auth);
  await sleep(200); // let the fire-and-forget status-change Activity writes land

  const fetched = await axios.get(`${BASE}/tasks/${timedTaskId}`, member.auth);
  const { statusDurations, totalWorkingMs } = fetched.data.data.task;
  assert.ok(statusDurations.in_progress >= 900, `in_progress duration recorded (got ${statusDurations.in_progress}ms)`);
  assert.ok(statusDurations.review >= 400, `review duration recorded (got ${statusDurations.review}ms)`);
  assert.equal(
    totalWorkingMs,
    statusDurations.in_progress + (statusDurations.review || 0) + (statusDurations.testing || 0),
    "totalWorkingMs sums exactly in_progress + review + testing"
  );
```

- [ ] **Step 2: Run it to verify it fails**

`node --env-file=.env scripts/smoke-accountability.js`
Expected: FAIL — `fetched.data.data.task.statusDurations` is `undefined`.

- [ ] **Step 3: Write the helper**

Create `backend/src/utils/statusDurations.js`:

```js
// Only these statuses count toward "total working time" — backlog/todo are
// idle waiting states, blocked is external, client_review is the client's
// clock, not ours. See 2026-07-30-task-accountability-design.md.
const WORKING_STATUSES = ["in_progress", "review", "testing"];

// Reconstructs time-in-status entirely from the status-change Activity log
// updateTask already writes — no separate tracking table. `activities` must
// be every Activity for this task, ascending by createdAt is NOT required
// (this function sorts internally).
export const computeStatusDurations = (task, activities) => {
  const statusChanges = activities
    .filter((a) => a.meta?.statusTo)
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const durationsMs = {};
  const add = (status, ms) => {
    if (ms <= 0) return;
    durationsMs[status] = (durationsMs[status] || 0) + ms;
  };

  let segmentStart = new Date(task.createdAt);
  let currentStatus = statusChanges[0]?.meta.statusFrom || task.status;

  for (const change of statusChanges) {
    const changedAt = new Date(change.createdAt);
    add(currentStatus, changedAt - segmentStart);
    segmentStart = changedAt;
    currentStatus = change.meta.statusTo;
  }

  if (currentStatus !== "completed") {
    add(currentStatus, new Date() - segmentStart);
  }

  const totalWorkingMs = WORKING_STATUSES.reduce((sum, status) => sum + (durationsMs[status] || 0), 0);
  return { durationsMs, totalWorkingMs };
};
```

- [ ] **Step 4: Attach it to `getTask`**

In `backend/src/controllers/taskController.js`, add the imports:

```js
import Activity from "../models/Activity.js";
import { computeStatusDurations } from "../utils/statusDurations.js";
```

Replace the body of `getTask` (keep the existing 404/403 checks) — after the existing `if (!project || !(await canViewProject(req.user, project))) {...}` check and before the final `return`, add:

```js
    const activities = await Activity.find({ entityType: "task", entityId: task._id })
      .select("meta createdAt")
      .lean();
    const { durationsMs, totalWorkingMs } = computeStatusDurations(task, activities);
    const taskWithTiming = { ...task.toObject(), statusDurations: durationsMs, totalWorkingMs };

    return res.json({ success: true, message: "Task fetched", data: { task: taskWithTiming } });
```

(replacing the existing `return res.json({ success: true, message: "Task fetched", data: { task } });` line at the end of `getTask`.)

- [ ] **Step 5: Run the smoke test again to verify it passes**

`node --env-file=.env scripts/smoke-accountability.js`
Expected: PASS.

- [ ] **Step 6: Run the full smoke suite**

`npm run smoke`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/statusDurations.js src/controllers/taskController.js scripts/smoke-accountability.js
git commit -m "Derive per-task time-in-status breakdown from the activity log"
```

---

### Task 8: Bugs tab + bug-aware TaskDialog + bug badge

**Files:**
- Modify: `frontend/components/tasks/TaskDialog.jsx`
- Modify: `frontend/components/tasks/TaskTable.jsx:54-62`
- Modify: `frontend/app/(app)/projects/[id]/page.js`

**Interfaces:**
- Consumes: `fetchTasks({ project, type })` — already a generic pass-through in `frontend/services/taskService.js`, no change needed there. `createTask` payload — already a generic pass-through, no change needed.
- Produces: `TaskDialog` gains optional props `lockedProjectId` (string) and `forceType` (`"task" | "bug"`, default `"task"`).

- [ ] **Step 1: Extend `TaskDialog.jsx`**

In `frontend/components/tasks/TaskDialog.jsx`, change the function signature:

```jsx
export default function TaskDialog({ open, onClose: onCloseProp, projects, directory, task, lockedProjectId, forceType = "task" }) {
```

Add `type: yup.string().oneOf(["task", "bug"])` handling via a conditional modules check — extend the `schema` object:

```jsx
const schema = yup.object({
  project: yup.string().required("Project is required"),
  title: yup.string().trim().required("Title is required"),
  type: yup.string().oneOf(["task", "bug"]).default("task"),
  modules: yup
    .array()
    .of(yup.string())
    .when("type", {
      is: "bug",
      then: (s) => s.min(1, "Bugs must be tagged to at least one module"),
    }),
  startTime: yup.string().nullable(),
  endTime: yup
    .string()
    .nullable()
    .test("time-slot", "Both times are required together, end after start", function (value) {
      const { startTime } = this.parent;
      if (!startTime && !value) return true;
      if (!!startTime !== !!value) return false;
      return value > startTime;
    }),
});
```

In the `reset({...})` call inside the `useEffect`, add:

```jsx
        project: lockedProjectId || task?.project || "",
        type: task?.type || forceType,
        reference: task?.reference || "",
```

(`project` line already exists — replace `task?.project || ""` with `lockedProjectId || task?.project || ""`.)

In the `mutation`'s `createTask({...})` payload, add `type: values.type || "task", reference: values.reference || "",`.

In the JSX, replace the `<Select label="Project" ...>` block: when `lockedProjectId` is set, render a disabled/readonly indicator instead —

```jsx
          {lockedProjectId ? (
            <input type="hidden" {...register("project")} value={lockedProjectId} />
          ) : (
            <Select label="Project" error={errors.project?.message} {...register("project")}>
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
```

(`react-hook-form`'s `register` doesn't play with a plain `<input type="hidden">`'s `value` prop reactively — simpler and consistent with how `reset()` already seeds `project`: since `lockedProjectId` is passed at open-time and `reset()` already sets `project: lockedProjectId || ...`, the hidden hardcoded hint above is redundant; drop the `<input type="hidden">` entirely and just conditionally render nothing/a label in its place:)

```jsx
          {lockedProjectId ? (
            <div className="flex items-center rounded-input border border-border bg-background/60 px-3 py-2 text-sm text-muted">
              {projects.find((p) => p._id === lockedProjectId)?.name || "This project"}
            </div>
          ) : (
            <Select label="Project" error={errors.project?.message} {...register("project")}>
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
```

Right after the `<Textarea label="Description" ... />` line, add the reference field, shown only for bugs:

```jsx
        {watch("type") === "bug" && (
          <Input label="Reference (optional)" placeholder="Link or note on what this bug came from" {...register("reference")} />
        )}
```

- [ ] **Step 2: Add the bug badge to `TaskTable.jsx`**

In `frontend/components/tasks/TaskTable.jsx`, in the title cell (line ~54-62), change:

```jsx
              <td className="max-w-[140px] px-4 py-3 sm:max-w-xs">
                <p className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{t.title}</span>
                  {["pending", "rejected"].includes(t.approvalStatus) && <Badge value={t.approvalStatus} />}
                </p>
```

to:

```jsx
              <td className="max-w-[140px] px-4 py-3 sm:max-w-xs">
                <p className="flex items-center gap-1.5">
                  {t.type === "bug" && <Badge value="bug" />}
                  <span className="truncate font-medium">{t.title}</span>
                  {["pending", "rejected"].includes(t.approvalStatus) && <Badge value={t.approvalStatus} />}
                </p>
```

- [ ] **Step 3: Add the Bugs tab**

In `frontend/app/(app)/projects/[id]/page.js`:

Change the imports to add `TaskDialog`:

```js
import TaskDialog from "@/components/tasks/TaskDialog";
```

Change:

```js
const TABS = ["overview", "modules", "tasks", "timeline", "activity"];
```
to:
```js
const TABS = ["overview", "modules", "bugs", "tasks", "timeline", "activity"];
```

Add state for the bug-creation dialog, next to the existing `openTask` state:

```js
  const [bugDialogOpen, setBugDialogOpen] = useState(false);
```

Add a query for bugs, next to the existing `tasks` query:

```js
  const { data: bugs = [] } = useQuery({
    queryKey: ["tasks", { project: id, type: "bug" }],
    queryFn: () => fetchTasks({ project: id, type: "bug" }),
    enabled: tab === "bugs",
  });
```

Add the tab body, right before the existing `{tab === "tasks" && (...)}` block:

```jsx
      {tab === "bugs" && (
        <div className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <Button onClick={() => setBugDialogOpen(true)}>
                <Plus size={16} /> New bug
              </Button>
            </div>
          )}
          {bugs.length ? (
            <TaskTable tasks={bugs} onOpen={setOpenTask} />
          ) : (
            <EmptyState icon={ClipboardList} heading="No bugs logged for this project" />
          )}
        </div>
      )}
```

At the bottom, next to the existing `<ModuleDialog .../>`, add:

```jsx
      <TaskDialog
        open={bugDialogOpen}
        onClose={() => setBugDialogOpen(false)}
        projects={[project]}
        directory={directory}
        lockedProjectId={id}
        forceType="bug"
      />
```

- [ ] **Step 4: Manually verify**

`cd frontend && npm run dev`. Open a project, go to the new "Bugs" tab: confirm it's empty initially with the empty-state message. Click "New bug": confirm the project field is locked/read-only, a red "Bug" badge appears once created, submitting without a module is rejected client-side with the "Bugs must be tagged to at least one module" message, and a created bug shows up in both the Bugs tab and the general Tasks tab (with its red badge).

- [ ] **Step 5: Commit**

```bash
git add components/tasks/TaskDialog.jsx components/tasks/TaskTable.jsx "app/(app)/projects/[id]/page.js"
git commit -m "Add Bugs project tab with mandatory-module bug creation"
```

---

### Task 9: TaskDrawer — bug reference + time-in-status display

**Files:**
- Modify: `frontend/components/tasks/TaskDrawer.jsx`

**Interfaces:**
- Consumes: `task.type`, `task.reference`, `task.statusDurations`, `task.totalWorkingMs` (Tasks 4, 7 — already present in the `GET /tasks/:id` response `fetchTask` already reads).

- [ ] **Step 1: Add a duration formatter and the bug badge**

In `frontend/components/tasks/TaskDrawer.jsx`, near the top (next to `fmtDate`/`fmtTime`), add:

```js
const fmtDuration = (ms) => {
  if (!ms || ms < 60000) return "< 1m";
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const STATUS_LABELS = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  review: "Review",
  testing: "Testing",
  client_review: "Client review",
  blocked: "Blocked",
};
```

Right after the existing `{task.recurrence && (...)}` block, add the bug badge + reference:

```jsx
          {task.type === "bug" && (
            <div className="flex items-center gap-2">
              <Badge value="bug" />
              {task.reference && <p className="text-xs text-muted">Reference: {task.reference}</p>}
            </div>
          )}
```

- [ ] **Step 2: Add the time-in-status section**

Right after the `</section>` closing the existing "Subtasks" section, add a new section:

```jsx
          {task.statusDurations && Object.keys(task.statusDurations).length > 0 && (
            <section>
              <h3 className="text-sm font-semibold">Time in status</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {Object.entries(task.statusDurations).map(([status, ms]) => (
                  <li key={status} className="flex items-center justify-between text-muted">
                    <span>
                      {STATUS_LABELS[status] || status}
                      {status === task.status && task.status !== "completed" ? " (ongoing)" : ""}
                    </span>
                    <span className="tabular-nums">{fmtDuration(ms)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm font-medium">
                <span>Total working time</span>
                <span className="tabular-nums text-primary">{fmtDuration(task.totalWorkingMs)}</span>
              </p>
            </section>
          )}
```

- [ ] **Step 3: Manually verify**

`cd frontend && npm run dev`. Open a task that has had a couple of status changes: confirm "Time in status" shows a duration per visited status, the current (non-completed) status is marked "(ongoing)", and "Total working time" sums only `in_progress`/`review`/`testing`. Open a bug task: confirm the red "Bug" badge and reference text render near the top.

- [ ] **Step 4: Commit**

```bash
git add components/tasks/TaskDrawer.jsx
git commit -m "Show bug badge/reference and time-in-status breakdown in the task drawer"
```

---

## Self-Review Notes

- **Spec coverage:** overdue penalty (Tasks 2, 5, 6), bug section (Tasks 4, 8, 9), time-in-status (Task 7), client_review (Task 1), admin-configurable penalties (Tasks 2, 3) — every spec section has a task.
- **Type consistency checked:** `getPenalties()`/`setPenalties()` (Task 2) are the exact names used by Tasks 3, 4, 5. `computeStatusDurations(task, activities)` (Task 7) signature matches its one call site in Task 7 Step 4. `applyOverduePenalties()` (Task 5) matches its use in `server.js` and the manual endpoint. `OVERDUE_EXEMPT_STATUSES` (Task 1) matches its use in Task 5's sweep query.
- **Resolved during self-review:** `Activity.actor` was `required` in the schema, but the sweep is system-triggered (no logged-in user to attribute it to). Task 5 Step 3 relaxes it to `default: null`, matching how `ActivityFeed.jsx:25` already renders a missing actor as "Someone" — no dangling TODO left for implementation time.
