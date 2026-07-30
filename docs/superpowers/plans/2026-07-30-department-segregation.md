# Department Segregation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make department the enforced visibility boundary everywhere except `admin`, replacing the ad hoc per-endpoint role checks that currently leak cross-department data (directory, leaderboard default, org listing) and the explicit-but-now-reversed decision that `manager` sees everything unconditionally.

**Architecture:** One shared `resolveDepartmentScope(user)` utility (in a renamed `departmentScope.js`, formerly `subadminScope.js`) becomes the single source of truth for "what can this user see," replacing scattered `role === "..."` branches. `manager` gains the same `managedDepartment` field `subadmin` already has and goes through the identical scoped code path.

**Tech Stack:** Express 5 + Mongoose ESM (backend), Next.js 16 JS-only (frontend), no test framework — verification is axios-based E2E smoke scripts (backend) and manual/curl checks (frontend, no browser automation available in this environment).

## Global Constraints

- Spec: `frontend/docs/superpowers/specs/2026-07-30-department-segregation-design.md` — every task implements one section of it.
- `admin` stays unrestricted everywhere — never add a department check that also catches `admin`.
- `resolveDepartmentScope(user)` returns `null` for admin (unrestricted), or `{ departmentId, teamIds, userIds }` for every other role — this exact shape is the contract every consumer below relies on.
- `manager` and `subadmin` derive scope from `user.managedDepartment` (one department each, no array). `sublead`/`member` derive it from `Team.findById(user.team).department` — their own team's department, not just their own team.
- A user with no `team` and no `managedDepartment` (role isn't manager/subadmin) resolves to `{ departmentId: null, teamIds: [], userIds: [user._id] }` — sees only themselves. Fail closed, not fail open.
- Reports, dashboards, AI workload/chat, notifications, calendar, follow-ups, activity feed are explicitly OUT OF SCOPE — already correctly scoped by a different principle (reporting-line/self). Do not touch `reportScopeFilter`, `canActForUser`, or any of their call sites.
- `User.department`'s drift from `team.department` is explicitly OUT OF SCOPE — left as a display-only field, not touched.
- Backend smoke scripts require the dev server running: `cd backend && npm run dev`, then `node --env-file=.env scripts/smoke-<name>.js` in another terminal.
- Known `node --watch` quirk (recurring in this codebase's dev server): it can silently stop picking up file changes. If behavior doesn't match a fresh edit, first touch `backend/src/server.js` and wait ~2s; only as a last resort, check what's actually bound to port 5000 (a stray/orphaned process sometimes ends up holding it instead of the current watcher) and gracefully `SIGTERM` + restart with `npm run dev &` — never `SIGKILL`, and disclose it if done.
- Frontend has no test framework — verify by compiling (`npm run dev`) and reasoning against real API responses; no browser automation is available in this environment. Disclose honestly what wasn't visually confirmed.

---

## File Structure

**Backend — modified:**
- `backend/src/controllers/userController.js`, `leaderboardController.js`, `aiController.js`, `reportController.js`, `dashboardController.js`, `followUpController.js`, `projectController.js`, `timeblockController.js` — import path update (Task 1) plus scoping logic changes (Tasks 2, 3, 5, 6).
- `backend/src/controllers/orgController.js` — Task 4.
- `backend/src/models/User.js` — comment update only (Task 1).
- `backend/src/routes/userRoutes.js` — Task 5 (validator extension only, no route change).
- `backend/src/app.js` — Task 7 (new route mount).
- `backend/package.json` — Task 2 (new smoke script registered).
- `frontend/components/team/UserDialog.jsx` — Task 5.

**Backend — new:**
- `backend/src/utils/departmentScope.js` (renamed from `subadminScope.js`) — Task 1.
- `backend/scripts/smoke-department-scope.js` — Tasks 2-6 append to it.
- `backend/src/models/DepartmentViolation.js` — Task 7.
- `backend/scripts/migrate-manager-departments.js` — Task 7.
- `backend/src/controllers/departmentViolationController.js` — Task 7.
- `backend/src/routes/departmentViolationRoutes.js` — Task 7.

**Frontend — new:**
- `frontend/app/(app)/admin/department-violations/page.js` — Task 8.
- `frontend/services/departmentViolationService.js` — Task 8.

---

### Task 1: Core scope-resolution utility

**Files:**
- Create: `backend/src/utils/departmentScope.js` (rename of `backend/src/utils/subadminScope.js`)
- Delete: `backend/src/utils/subadminScope.js`
- Modify: `backend/src/controllers/userController.js:5`, `leaderboardController.js:6`, `aiController.js:11`, `reportController.js:4`, `dashboardController.js:9`, `followUpController.js:8`, `projectController.js:8`, `timeblockController.js:3` (import path only, one line each)
- Modify: `backend/src/models/User.js:15` (comment text only)
- Test: run the FULL existing smoke suite (no new test file yet — this task is a pure refactor plus one new, not-yet-consumed export)

**Interfaces:**
- Produces: `resolveDepartmentScope(user): Promise<null | { departmentId, teamIds: ObjectId[], userIds: ObjectId[] }>`, consumed by Tasks 2, 3, 4, 5, 6.
- Produces (unchanged, just relocated): `getManagedTeamIds(departmentId)`, `getManagedUserIds(subadminUser)`, still exported from the new file path.

- [ ] **Step 1: Rename the file and add the new export**

Read the current full contents of `backend/src/utils/subadminScope.js` (already known: `getManagedTeamIds`, `getManagedUserIds`, `reportScopeFilter`). Create `backend/src/utils/departmentScope.js` with all three existing exports unchanged, plus:

```js
import Team from "../models/Team.js";

// Resolves ANY role's department-visibility scope — the single source of
// truth every controller below calls instead of branching on role itself.
// - admin: null (unrestricted)
// - manager, subadmin: their managedDepartment (one department each)
// - sublead, member: their own team's department (not just their own team —
//   segregation's boundary is department, per 2026-07-30-department-segregation-design.md)
// - no team and not manager/subadmin: sees only themselves (fail closed)
export const resolveDepartmentScope = async (user) => {
  if (user.role === "admin") return null;
  if (["manager", "subadmin"].includes(user.role)) {
    const teamIds = await getManagedTeamIds(user.managedDepartment);
    const userIds = await getManagedUserIds(user);
    return { departmentId: user.managedDepartment, teamIds, userIds };
  }
  if (!user.team) {
    return { departmentId: null, teamIds: [], userIds: [user._id] };
  }
  const team = await Team.findById(user.team, "department");
  const teamIds = await getManagedTeamIds(team.department);
  const users = await User.find({ team: { $in: teamIds } }, "_id");
  return { departmentId: team.department, teamIds, userIds: users.map((u) => u._id) };
};
```

Note: `getManagedUserIds` needs `User` imported — check the existing file already imports `User` from `../models/User.js` (it does, for its own body) and reuse that same import; don't add a second one.

- [ ] **Step 2: Delete the old file**

`rm backend/src/utils/subadminScope.js`

- [ ] **Step 3: Update every importer's path**

In each of these 8 files, change `from "../utils/subadminScope.js"` to `from "../utils/departmentScope.js"` — the imported names on each line stay exactly the same, only the path changes:
- `backend/src/controllers/userController.js:5`
- `backend/src/controllers/leaderboardController.js:6`
- `backend/src/controllers/aiController.js:11`
- `backend/src/controllers/reportController.js:4`
- `backend/src/controllers/dashboardController.js:9`
- `backend/src/controllers/followUpController.js:8`
- `backend/src/controllers/projectController.js:8`
- `backend/src/controllers/timeblockController.js:3`

In `backend/src/models/User.js:15`, update the comment `(see subadminScope.js)` to `(see departmentScope.js)`.

- [ ] **Step 4: Run the full existing smoke suite to confirm the rename broke nothing**

Run each script individually (the chained `npm run smoke` halts at the first of two known, pre-existing, unrelated failures — `smoke-auth.js`, `smoke-followups.js` — skip those two, every other script must pass): `smoke-users`, `smoke-org`, `smoke-projects`, `smoke-tasks-extra`, `smoke-approval`, `smoke-timeblocks`, `smoke-notifications`, `smoke-dashboard`, `smoke-leaderboard`, `smoke-ai`, `smoke-subadmin`, `smoke-accountability`.

Expected: all PASS, identical to before this task (pure rename, no behavior change yet — `resolveDepartmentScope` isn't called by anything yet).

- [ ] **Step 5: Commit**

```bash
git add -A src/utils/departmentScope.js src/controllers/userController.js src/controllers/leaderboardController.js src/controllers/aiController.js src/controllers/reportController.js src/controllers/dashboardController.js src/controllers/followUpController.js src/controllers/projectController.js src/controllers/timeblockController.js src/models/User.js
git status  # confirm subadminScope.js shows as deleted, departmentScope.js as new
git commit -m "Rename subadminScope.js to departmentScope.js, add resolveDepartmentScope()"
```

---

### Task 2: Scope the directory endpoint

**Files:**
- Modify: `backend/src/controllers/userController.js`'s `listDirectory` (currently lines 97-108)
- Create: `backend/scripts/smoke-department-scope.js`
- Modify: `backend/package.json` (register the new smoke script)

**Interfaces:**
- Consumes: `resolveDepartmentScope` (Task 1).
- Produces: nothing new consumed by later tasks — this is a leaf endpoint fix.

- [ ] **Step 1: Write the failing smoke test**

Create `backend/scripts/smoke-department-scope.js`:

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
  const res = await axios.post(`${BASE}/users`, { name, email, password, role, ...extra }, adminAuth);
  const login = await axios.post(`${BASE}/auth/login`, { email, password });
  return {
    name,
    userId: res.data.data.user._id,
    auth: { headers: { Authorization: `Bearer ${login.data.data.accessToken}` } },
  };
};

const run = async () => {
  const adminAuth = await authFor(EMAIL, PASSWORD);

  // Two separate departments, each with one team, so we can prove cross-
  // department isolation rather than just "some" filtering.
  const deptA = await axios.post(`${BASE}/departments`, { name: `Smoke Dept A ${Date.now()}` }, adminAuth);
  const deptB = await axios.post(`${BASE}/departments`, { name: `Smoke Dept B ${Date.now()}` }, adminAuth);
  const deptAId = deptA.data.data.department._id;
  const deptBId = deptB.data.data.department._id;
  const teamA = await axios.post(`${BASE}/teams`, { name: `Smoke Team A ${Date.now()}`, department: deptAId }, adminAuth);
  const teamB = await axios.post(`${BASE}/teams`, { name: `Smoke Team B ${Date.now()}`, department: deptBId }, adminAuth);
  const teamAId = teamA.data.data.team._id;
  const teamBId = teamB.data.data.team._id;

  const memberA1 = await createUser(adminAuth, "member", { team: teamAId });
  const memberA2 = await createUser(adminAuth, "member", { team: teamAId });
  const memberB = await createUser(adminAuth, "member", { team: teamBId });

  // --- Task 2: directory is department-scoped ---

  const dirA1 = await axios.get(`${BASE}/users/directory`, memberA1.auth);
  const namesA1 = dirA1.data.data.users.map((u) => u.name);
  assert.ok(namesA1.includes(memberA2.name), "same-department sibling (different team not required) is visible");
  assert.ok(!namesA1.includes(memberB.name), "a different department's member is NOT visible in the directory");

  const dirAdmin = await axios.get(`${BASE}/users/directory`, adminAuth);
  assert.ok(
    dirAdmin.data.data.users.map((u) => u.name).includes(memberB.name),
    "admin's directory is unrestricted, sees every department"
  );

  console.log("smoke-department-scope: all checks passed");
};

run().catch((error) => {
  console.error("smoke-department-scope failed:", error.response?.data?.message || error.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run it to verify it fails**

`cd backend && node --env-file=.env scripts/smoke-department-scope.js`
Expected: FAIL — `listDirectory` currently returns every user unfiltered, so `namesA1.includes(memberB.name)` is true, failing the "NOT visible" assertion.

- [ ] **Step 3: Fix `listDirectory`**

In `backend/src/controllers/userController.js`, add the import (alongside the existing `getManagedTeamIds, getManagedUserIds` import from Task 1's renamed path):

```js
import { getManagedTeamIds, getManagedUserIds, resolveDepartmentScope } from "../utils/departmentScope.js";
```

Replace `listDirectory`:

```js
export const listDirectory = async (req, res) => {
  try {
    const scope = await resolveDepartmentScope(req.user);
    const filter = scope ? { team: { $in: scope.teamIds } } : {};
    const users = await User.find(filter)
      .select("name role designation department team")
      .populate("department", "name")
      .populate("team", "name");
    return res.json({ success: true, message: "Directory fetched", data: { users } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
```

- [ ] **Step 4: Run the smoke test again to verify it passes**

`node --env-file=.env scripts/smoke-department-scope.js`
Expected: PASS.

- [ ] **Step 5: Run the full smoke suite to confirm no regressions**

Same script list as Task 1 Step 4. Pay particular attention to `smoke-subadmin.js` and `smoke-tasks-extra.js`/`smoke-projects.js` (whichever exercise `fetchDirectory`-backed pickers) — all must still pass, since a user with no team (e.g. many existing smoke-script fixtures created without a `team`) now resolves to `{ userIds: [self] }` via Task 1's fail-closed branch, which could tighten `listDirectory`'s results for those fixtures. If any assertion elsewhere in the suite relied on seeing a teamless-created user in someone else's directory call, it will surface here — investigate and reconcile before moving on (don't silently loosen the new scoping to make it pass; if a test's fixture setup needs a `team`, add one there instead).

- [ ] **Step 6: Register the new smoke script**

In `backend/package.json`'s `smoke` script, append ` && node --env-file=.env scripts/smoke-department-scope.js` to the end of the existing chain.

- [ ] **Step 7: Commit**

```bash
git add src/controllers/userController.js scripts/smoke-department-scope.js package.json
git commit -m "Scope the user directory endpoint by department"
```

---

### Task 3: Scope the leaderboard's default roster

**Files:**
- Modify: `backend/src/controllers/leaderboardController.js`'s `getLeaderboard` (currently lines 30-182, specifically the roster-filter block at lines 60-74)
- Test: `backend/scripts/smoke-department-scope.js` (append)

**Interfaces:**
- Consumes: `resolveDepartmentScope` (Task 1).

- [ ] **Step 1: Write the failing smoke test**

Append to `backend/scripts/smoke-department-scope.js`, before `console.log("smoke-department-scope: all checks passed");`. Note the leaderboard is Monday-locked for non-admin/subadmin roles unless `format=csv` — use CSV export throughout, matching this repo's existing `smoke-leaderboard.js` pattern:

```js
  // --- Task 3: leaderboard's default roster (no ?team=) is department-scoped ---

  const csvA1 = await axios.get(`${BASE}/leaderboard?format=csv`, memberA1.auth);
  assert.equal(csvA1.status, 403, "a plain member cannot export the csv report (unchanged, pre-existing rule)");

  const manager1 = await createUser(adminAuth, "manager", { managedDepartment: deptAId });
  const csvManagerDefault = await axios.get(`${BASE}/leaderboard?format=csv`, manager1.auth);
  assert.equal(csvManagerDefault.status, 200);
  assert.ok(
    csvManagerDefault.data.includes(memberA1.name) || csvManagerDefault.data.includes(memberA2.name),
    "Department-A manager's default roster includes at least one Department-A member"
  );
  assert.ok(
    !csvManagerDefault.data.includes(memberB.name),
    "Department-A manager's default roster (no ?team=) excludes a Department-B member"
  );

  const csvManagerCrossTeam = await axios.get(
    `${BASE}/leaderboard?format=csv&team=${teamBId}`,
    { ...manager1.auth, validateStatus: () => true }
  );
  assert.equal(csvManagerCrossTeam.status, 403, "a manager cannot use ?team= to reach a team outside their own department");
```

- [ ] **Step 2: Run it to verify it fails**

`node --env-file=.env scripts/smoke-department-scope.js`
Expected: FAIL — a manager's `?team=` is currently unrestricted (no 403), and their default roster currently includes the whole org (Department B's member would be present).

- [ ] **Step 3: Generalize the roster-filter block**

In `backend/src/controllers/leaderboardController.js`, replace the existing import (`import { getManagedTeamIds } from "../utils/departmentScope.js";`) with:

```js
import { resolveDepartmentScope } from "../utils/departmentScope.js";
```

`getManagedTeamIds` is dropped entirely here, not kept alongside — after this step's replacement below, nothing in this file calls it directly anymore (the roster filter now goes through `scope.teamIds` instead), and keeping an unused import would be dead code.

Replace the roster-filter block (currently lines 60-74):

```js
    const rosterFilter = { isActive: true, role: { $ne: "admin" } };
    const scope = await resolveDepartmentScope(req.user);
    if (scope) {
      rosterFilter.role = { $nin: ["admin", "subadmin"] };
      if (req.query.team) {
        if (!scope.teamIds.map(String).includes(String(req.query.team))) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }
        rosterFilter.team = req.query.team;
      } else {
        rosterFilter.team = { $in: scope.teamIds };
      }
    }
```

This replaces the old `if (req.user.role === "subadmin") {...} else if (req.query.team) {...}` — the `subadmin`-only branch generalizes to every non-admin role (`scope` is non-null for anyone but admin), and the old unrestricted `else if (req.query.team)` branch (which let manager/sublead/member pass through any `?team=` value) is gone, replaced by the same scope-membership check subadmin already had.

- [ ] **Step 4: Run the smoke test again to verify it passes**

`node --env-file=.env scripts/smoke-department-scope.js`
Expected: PASS.

- [ ] **Step 5: Run the full smoke suite**

Same list as before. `smoke-leaderboard.js` specifically exercises subadmin's team-filter behavior and the org-wide export for admin/manager — both must be byte-for-byte unchanged (admin still sees everyone; subadmin's existing assertions must still pass exactly, since `subadmin`'s branch in the new `resolveDepartmentScope`-based code is logically identical to before, just relocated).

- [ ] **Step 6: Commit**

```bash
git add src/controllers/leaderboardController.js scripts/smoke-department-scope.js
git commit -m "Generalize leaderboard roster scoping to every non-admin role"
```

---

### Task 4: Scope departments/teams listing

**Files:**
- Modify: `backend/src/controllers/orgController.js`'s `listDepartments` (lines 18-26) and `listTeams` (lines 83-91)
- Test: `backend/scripts/smoke-department-scope.js` (append)

**Interfaces:**
- Consumes: `resolveDepartmentScope` (Task 1).

- [ ] **Step 1: Write the failing smoke test**

Append to `backend/scripts/smoke-department-scope.js`:

```js
  // --- Task 4: departments/teams listing is department-scoped ---

  const deptsAsMemberA = await axios.get(`${BASE}/departments`, memberA1.auth);
  const deptNamesA = deptsAsMemberA.data.data.departments.map((d) => d.name);
  assert.ok(!deptNamesA.includes(deptB.data.data.department.name), "member cannot see Department B in the departments list");

  const teamsAsMemberA = await axios.get(`${BASE}/teams`, memberA1.auth);
  const teamNamesA = teamsAsMemberA.data.data.teams.map((t) => t.name);
  assert.ok(!teamNamesA.includes(teamB.data.data.team.name), "member cannot see Team B (Department B) in the teams list");
  assert.ok(teamNamesA.includes(teamA.data.data.team.name), "member CAN see their own Team A");

  const deptsAsAdmin = await axios.get(`${BASE}/departments`, adminAuth);
  assert.ok(
    deptsAsAdmin.data.data.departments.map((d) => d.name).includes(deptB.data.data.department.name),
    "admin's departments list is unrestricted"
  );
```

- [ ] **Step 2: Run it to verify it fails**

`node --env-file=.env scripts/smoke-department-scope.js`
Expected: FAIL — both listings currently return every department/team with no filter.

- [ ] **Step 3: Fix `listDepartments` and `listTeams`**

In `backend/src/controllers/orgController.js`, add the import:

```js
import { resolveDepartmentScope } from "../utils/departmentScope.js";
```

Replace `listDepartments`:

```js
export const listDepartments = async (req, res) => {
  try {
    const scope = await resolveDepartmentScope(req.user);
    const filter = scope ? { _id: scope.departmentId } : {};
    const departments = await Department.find(filter).sort("name");
    return res.json({ success: true, message: "Departments fetched", data: { departments } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
```

Replace `listTeams`:

```js
export const listTeams = async (req, res) => {
  try {
    const scope = await resolveDepartmentScope(req.user);
    const filter = scope ? { _id: { $in: scope.teamIds } } : {};
    const teams = await Team.find(filter).populate("department", "name").sort("name");
    return res.json({ success: true, message: "Teams fetched", data: { teams } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
```

(`scope.departmentId` is `null` for a teamless non-privileged user per Task 1's fail-closed branch — `Department.find({_id: null})` correctly returns zero results, which is the intended "sees nothing" outcome for that edge case.)

- [ ] **Step 4: Run the smoke test again to verify it passes**

`node --env-file=.env scripts/smoke-department-scope.js`
Expected: PASS.

- [ ] **Step 5: Run the full smoke suite**

Same list. `smoke-org.js` and `smoke-subadmin.js` both exercise team/department listing — confirm subadmin's existing "sees only their managed department's teams" assertions still pass unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/controllers/orgController.js scripts/smoke-department-scope.js
git commit -m "Scope departments/teams listing by department"
```

---

### Task 5: Manager becomes a department-scoped role

**Files:**
- Modify: `backend/src/validators/userValidators.js` (`validateCreateUser`, line 21-25)
- Modify: `backend/src/controllers/userController.js` (`updateUser`, lines 153-169)
- Modify: `backend/src/controllers/projectController.js` (`canManage` lines 14-22, `canViewProject` lines 26-41, `visibilityFilter` lines 45-61)
- Modify: `frontend/components/team/UserDialog.jsx`
- Test: `backend/scripts/smoke-department-scope.js` (append)

**Interfaces:**
- Consumes: `resolveDepartmentScope` (Task 1).
- Produces: managers can now have `managedDepartment` set; `manager`'s project/task visibility is scoped identically to `subadmin`'s — consumed implicitly by Task 6 (which needs a manager's scope to validate `createProject` against) and Task 7 (migration assigns this field).

- [ ] **Step 1: Write the failing smoke test**

Append to `backend/scripts/smoke-department-scope.js`:

```js
  // --- Task 5: manager requires managedDepartment, and is scoped to it ---

  const managerNoDept = await axios.post(
    `${BASE}/users`,
    { name: "Bad Manager", email: `badmanager+${Date.now()}@wos.local`, password: "smokepass123", role: "manager" },
    { ...adminAuth, validateStatus: () => true }
  );
  assert.equal(managerNoDept.status, 400, "creating a manager with no managedDepartment is rejected");

  const projectA = await axios.post(
    `${BASE}/projects`,
    { name: `Smoke Project A ${Date.now()}`, manager: manager1.userId, members: [memberA1.userId] },
    adminAuth
  );
  const projectAId = projectA.data.data.project._id;

  const manager2 = await createUser(adminAuth, "manager", { managedDepartment: deptBId });
  const projectB = await axios.post(
    `${BASE}/projects`,
    { name: `Smoke Project B ${Date.now()}`, manager: manager2.userId, members: [memberB.userId] },
    adminAuth
  );
  const projectBId = projectB.data.data.project._id;

  const manager1SeesA = await axios.get(`${BASE}/projects/${projectAId}`, { ...manager1.auth, validateStatus: () => true });
  assert.equal(manager1SeesA.status, 200, "Department-A manager can see a Department-A project they manage");

  const manager1SeesB = await axios.get(`${BASE}/projects/${projectBId}`, { ...manager1.auth, validateStatus: () => true });
  assert.equal(manager1SeesB.status, 403, "Department-A manager CANNOT see a Department-B project (was unconditional before this task)");

  const listAsManager1 = await axios.get(`${BASE}/projects?limit=100`, manager1.auth);
  const namesAsManager1 = listAsManager1.data.data.projects.map((p) => p.name);
  assert.ok(namesAsManager1.includes(projectA.data.data.project.name), "manager1's project list includes their own Department-A project");
  assert.ok(!namesAsManager1.includes(projectB.data.data.project.name), "manager1's project list excludes the Department-B project");
```

- [ ] **Step 2: Run it to verify it fails**

`node --env-file=.env scripts/smoke-department-scope.js`
Expected: FAIL — `managerNoDept` currently succeeds (201, no validation), and `manager1SeesB` currently succeeds (200, manager sees everything).

- [ ] **Step 3: Extend creation/update validation**

In `backend/src/validators/userValidators.js`, change:

```js
  if (role === "subadmin" && !managedDepartment) {
```
to:
```js
  if (["manager", "subadmin"].includes(role) && !managedDepartment) {
```
(the error message on the next line can stay as-is, or generalize to `"managedDepartment is required for the manager/subadmin roles"` — either is fine, prefer the generalized message for clarity).

In `backend/src/controllers/userController.js`'s `updateUser`, change (inside the `else` branch, i.e. the admin-actor path — currently lines 154-168):

```js
      const resultingRole = "role" in updates ? updates.role : target.role;
      if (resultingRole === "subadmin") {
        const resultingManagedDepartment =
          "managedDepartment" in updates ? updates.managedDepartment : target.managedDepartment;
        if (!resultingManagedDepartment) {
          return res.status(400).json({
            success: false,
            message: "managedDepartment is required for the subadmin role",
          });
        }
      } else {
        updates.managedDepartment = null;
      }
```
to:
```js
      const resultingRole = "role" in updates ? updates.role : target.role;
      if (["manager", "subadmin"].includes(resultingRole)) {
        const resultingManagedDepartment =
          "managedDepartment" in updates ? updates.managedDepartment : target.managedDepartment;
        if (!resultingManagedDepartment) {
          return res.status(400).json({
            success: false,
            message: "managedDepartment is required for the manager/subadmin roles",
          });
        }
      } else {
        updates.managedDepartment = null;
      }
```

- [ ] **Step 4: Move `manager` into the scoped branch in `projectController.js`**

`projectController.js` currently imports `{ getManagedUserIds, getManagedTeamIds }` from this path — `getManagedTeamIds` is used by `listProjects`' existing `?team=` filter (added in an earlier, unrelated change) and must be kept. Replace the import with:
```js
import { getManagedUserIds, getManagedTeamIds, resolveDepartmentScope } from "../utils/departmentScope.js";
```

Replace `canManage` (currently lines 14-22):
```js
const canManage = async (user, project) => {
  if (user.role === "admin") return true;
  if (idOf(project.manager) === String(user._id)) return true;
  if (["manager", "subadmin"].includes(user.role)) {
    const managedIds = (await getManagedUserIds(user)).map(String);
    return managedIds.includes(idOf(project.manager));
  }
  return false;
};
```

Replace `canViewProject` (currently lines 26-41) — every `user.role === "subadmin"` check becomes `["manager", "subadmin"].includes(user.role)`, and every `["admin", "manager"].includes(user.role)` unconditional-true check becomes `user.role === "admin"`:
```js
export const canViewProject = async (user, project) => {
  if (user.role === "admin") return true;
  if (idOf(project.manager) === String(user._id)) return true;
  if ((project.members || []).some((m) => idOf(m) === String(user._id))) return true;
  if (["manager", "subadmin"].includes(user.role)) {
    const managedIds = (await getManagedUserIds(user)).map(String);
    if (managedIds.includes(idOf(project.manager))) return true;
    if ((project.members || []).some((m) => managedIds.includes(idOf(m)))) return true;
  }
  const scopeIds =
    ["manager", "subadmin"].includes(user.role) ? [...(await getManagedUserIds(user)), user._id] : [user._id];
  const assignedToAModule = await ProjectModule.exists({ project: project._id, assignees: { $in: scopeIds } });
  if (assignedToAModule) return true;
  const assignedToATask = await Task.exists({ project: project._id, assignees: { $in: scopeIds } });
  return !!assignedToATask;
};
```

Replace `visibilityFilter` (currently lines 45-61):
```js
export const visibilityFilter = async (user) => {
  if (user.role === "admin") return {};
  const scopeIds =
    ["manager", "subadmin"].includes(user.role) ? [...(await getManagedUserIds(user)), user._id] : [user._id];
  const [assignedModuleProjectIds, assignedTaskProjectIds] = await Promise.all([
    ProjectModule.find({ assignees: { $in: scopeIds } }).distinct("project"),
    Task.find({ assignees: { $in: scopeIds } }).distinct("project"),
  ]);
  const assignedProjectIds = [...assignedModuleProjectIds, ...assignedTaskProjectIds];
  return {
    $or: [
      { members: { $in: scopeIds } },
      { manager: { $in: scopeIds } },
      { _id: { $in: assignedProjectIds } },
    ],
  };
};
```

Note: `resolveDepartmentScope` isn't actually called inside these three functions in the end — they reuse `getManagedUserIds` directly (identical to how `subadmin` already worked), since `visibilityFilter`'s combined-scope reasoning (own `_id` plus managed set) is specific to this file and doesn't need the generic wrapper. This is intentional, not a missed step — the generic `resolveDepartmentScope` is for endpoints that need the *whole* scope shape (`teamIds` for a query, or the null/non-null admin check); these three functions only ever needed `getManagedUserIds`, which subadmin already used.

- [ ] **Step 5: Frontend — allow `managedDepartment` for manager**

In `frontend/components/team/UserDialog.jsx`, change the yup schema:
```js
  managedDepartment: yup.string().when("role", {
    is: "subadmin",
    then: (s) => s.required("Managed department is required for the subadmin role"),
    otherwise: (s) => s.strip(),
  }),
```
to:
```js
  managedDepartment: yup.string().when("role", {
    is: (role) => role === "subadmin" || role === "manager",
    then: (s) => s.required("Managed department is required for this role"),
    otherwise: (s) => s.strip(),
  }),
```

Change the mutation payload builder:
```js
        managedDepartment: values.role === "subadmin" ? values.managedDepartment || null : null,
```
to:
```js
        managedDepartment:
          values.role === "subadmin" || values.role === "manager" ? values.managedDepartment || null : null,
```

Change the conditional field render:
```jsx
        {selectedRole === "subadmin" && (
```
to:
```jsx
        {(selectedRole === "subadmin" || selectedRole === "manager") && (
```

- [ ] **Step 6: Run the smoke test again to verify it passes**

`node --env-file=.env scripts/smoke-department-scope.js`
Expected: PASS.

- [ ] **Step 7: Run the full smoke suite**

Same list. `smoke-subadmin.js`'s project-visibility assertions must be byte-for-byte unchanged (subadmin's own scoping logic is untouched, only the role-check condition alongside it changed from an exact `=== "subadmin"` to an array-includes that also matches manager). `smoke-projects.js`, `smoke-tasks-extra.js`, `smoke-dashboard.js`, `smoke-ai.js`, `smoke-leaderboard.js` all have manager-created fixtures without a `managedDepartment` today — check whether any of their existing assertions assumed manager's old unconditional visibility; if so, those fixtures need a `managedDepartment` added (same department as whatever they're asserting visibility into) rather than loosening this task's new check.

- [ ] **Step 8: Verify the frontend compiles**

`cd frontend && npm run dev` (pick a free port), confirm no compile errors, and reason through: does the "Managed department" field now render when `Role` is set to "Manager" in the create/edit user dialog? Since no browser automation is available, verify via a clean compile plus reading the JSX condition change — disclose this limitation rather than claiming a visual confirmation.

- [ ] **Step 9: Commit**

```bash
cd backend && git add src/validators/userValidators.js src/controllers/userController.js src/controllers/projectController.js scripts/smoke-department-scope.js
git commit -m "Make manager a department-scoped role, matching subadmin"
cd ../frontend && git add components/team/UserDialog.jsx
git commit -m "Allow managedDepartment to be set for the manager role"
```

---

### Task 6: Validate department on project creation

**Files:**
- Modify: `backend/src/controllers/projectController.js`'s `createProject` (currently lines 63-97)
- Test: `backend/scripts/smoke-department-scope.js` (append)

**Interfaces:**
- Consumes: `resolveDepartmentScope` (Task 1).

- [ ] **Step 1: Write the failing smoke test**

Append to `backend/scripts/smoke-department-scope.js`:

`createProject`'s route is `authorize("admin", "manager", "subadmin")` (confirmed in `projectRoutes.js`), so `manager1` can call it directly:

```js
  // --- Task 6: createProject validates department for scoped roles ---

  const managerCrossDept = await axios.post(
    `${BASE}/projects`,
    { name: "Should fail cross-dept", manager: manager1.userId, members: [memberB.userId] },
    { ...manager1.auth, validateStatus: () => true }
  );
  assert.equal(managerCrossDept.status, 400, "a Department-A manager cannot create a project with a Department-B member");

  const managerSameDept = await axios.post(
    `${BASE}/projects`,
    { name: `Smoke Same-Dept Project ${Date.now()}`, manager: manager1.userId, members: [memberA2.userId] },
    manager1.auth
  );
  assert.equal(managerSameDept.status, 201, "a Department-A manager CAN create a project with only Department-A members");
  await axios.delete(`${BASE}/projects/${managerSameDept.data.data.project._id}`, adminAuth);

  const adminCrossDept = await axios.post(
    `${BASE}/projects`,
    { name: `Smoke Cross-Dept Project ${Date.now()}`, manager: manager1.userId, members: [memberB.userId] },
    adminAuth
  );
  assert.equal(adminCrossDept.status, 201, "admin (unrestricted) CAN create a project spanning departments");
  await axios.delete(`${BASE}/projects/${adminCrossDept.data.data.project._id}`, adminAuth);
```

- [ ] **Step 2: Run it to verify it fails**

`node --env-file=.env scripts/smoke-department-scope.js`
Expected: FAIL — `managerCrossDept` currently succeeds (201, no validation at all today).

- [ ] **Step 3: Add the validation**

In `backend/src/controllers/projectController.js`'s `createProject`, after destructuring `req.body` and before `Project.create(...)` (currently right after line 65), add:

```js
    const scope = await resolveDepartmentScope(req.user);
    if (scope) {
      const allowedIds = new Set([...scope.userIds.map(String), String(req.user._id)]);
      const candidateIds = [manager, ...(members || [])].filter(Boolean).map(String);
      const outOfScope = candidateIds.find((id) => !allowedIds.has(id));
      if (outOfScope) {
        return res.status(400).json({
          success: false,
          message: `User ${outOfScope} is outside your department`,
        });
      }
    }
```

(`resolveDepartmentScope` is already imported into this file per Task 5 Step 4's import change — `createProject` lives in the same `projectController.js` as `visibilityFilter`/`canViewProject`, so no new import line is needed here.)

- [ ] **Step 4: Run the smoke test again to verify it passes**

`node --env-file=.env scripts/smoke-department-scope.js`
Expected: PASS.

- [ ] **Step 5: Run the full smoke suite**

Same list. `smoke-projects.js` creates projects via a plain `manager` fixture with no `managedDepartment` — since Task 5 now requires managers to have a department, and this task now validates project membership against it, check whether `smoke-projects.js`'s own manager fixture needs a `managedDepartment` + department-consistent members added to keep passing (likely yes — update that fixture rather than loosening this task's check).

- [ ] **Step 6: Commit**

```bash
git add src/controllers/projectController.js scripts/smoke-department-scope.js
git commit -m "Validate manager/members are in-department when a scoped role creates a project"
```

---

### Task 7: Migration script + violations tracking

**Files:**
- Create: `backend/src/models/DepartmentViolation.js`
- Create: `backend/scripts/migrate-manager-departments.js`
- Create: `backend/src/controllers/departmentViolationController.js`
- Create: `backend/src/routes/departmentViolationRoutes.js`
- Modify: `backend/src/app.js` (mount the new route)
- Test: `backend/scripts/smoke-department-scope.js` (append)

**Interfaces:**
- Consumes: nothing from Task 1's exports directly — the migration script resolves department via its own inline `Team.findById` lookup (it runs standalone against Mongo, not through the app's request-scoped controllers, so it doesn't import `departmentScope.js`).
- Produces: `GET /department-violations` (admin-only), returning `{ violations: [...] }`, consumed by Task 8.

- [ ] **Step 1: Create the model**

Create `backend/src/models/DepartmentViolation.js`:

```js
import mongoose from "mongoose";

// One row per pre-existing Project whose manager/members span more than one
// department under the new department-segregation rule (2026-07-30). Written
// once by migrate-manager-departments.js; not auto-fixed, surfaced for an
// admin to review at their own pace.
const departmentViolationSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],
    flaggedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("DepartmentViolation", departmentViolationSchema);
```

- [ ] **Step 2: Write the migration script**

Create `backend/scripts/migrate-manager-departments.js`, following this repo's existing `migrate-*.js` convention (a standalone script run once via `node --env-file=.env scripts/migrate-manager-departments.js`, connecting directly to Mongo, not via HTTP):

```js
import mongoose from "mongoose";
import "dotenv/config";

import User from "../src/models/User.js";
import Project from "../src/models/Project.js";
import Team from "../src/models/Team.js";
import DepartmentViolation from "../src/models/DepartmentViolation.js";

const departmentOf = async (userId, teamCache) => {
  const user = await User.findById(userId, "team");
  if (!user?.team) return null;
  const key = String(user.team);
  if (!teamCache.has(key)) {
    const team = await Team.findById(user.team, "department");
    teamCache.set(key, team ? String(team.department) : null);
  }
  return teamCache.get(key);
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const teamCache = new Map();

  const managers = await User.find({ role: "manager", managedDepartment: null });
  let assigned = 0;
  let unresolved = 0;

  for (const manager of managers) {
    const managedProjects = await Project.find({ manager: manager._id }, "members");
    const departmentCounts = new Map();

    for (const project of managedProjects) {
      for (const memberId of project.members) {
        const dept = await departmentOf(memberId, teamCache);
        if (dept) departmentCounts.set(dept, (departmentCounts.get(dept) || 0) + 1);
      }
    }

    let inferred = null;
    if (departmentCounts.size > 0) {
      inferred = [...departmentCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    } else {
      inferred = await departmentOf(manager._id, teamCache);
    }

    if (inferred) {
      manager.managedDepartment = inferred;
      await manager.save();
      assigned += 1;
    } else {
      unresolved += 1;
    }
  }

  const allProjects = await Project.find({}, "manager members");
  let flagged = 0;
  for (const project of allProjects) {
    const departments = new Set();
    const managerDept = await departmentOf(project.manager, teamCache);
    if (managerDept) departments.add(managerDept);
    for (const memberId of project.members) {
      const dept = await departmentOf(memberId, teamCache);
      if (dept) departments.add(dept);
    }
    if (departments.size > 1) {
      await DepartmentViolation.create({ project: project._id, departments: [...departments] });
      flagged += 1;
    }
  }

  console.log(`Managers auto-assigned: ${assigned}`);
  console.log(`Managers left unresolved (no signal): ${unresolved}`);
  console.log(`Projects flagged as cross-department: ${flagged}`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("migrate-manager-departments failed:", error.message);
  process.exit(1);
});
```

- [ ] **Step 3: Create the controller and route**

Create `backend/src/controllers/departmentViolationController.js`:

```js
import DepartmentViolation from "../models/DepartmentViolation.js";

export const listDepartmentViolations = async (req, res) => {
  try {
    const violations = await DepartmentViolation.find()
      .populate("project", "name")
      .populate("departments", "name")
      .sort("-flaggedAt");
    return res.json({ success: true, message: "Department violations fetched", data: { violations } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
```

Create `backend/src/routes/departmentViolationRoutes.js`:

```js
import { Router } from "express";

import { listDepartmentViolations } from "../controllers/departmentViolationController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);
router.get("/", authorize("admin"), listDepartmentViolations);

export default router;
```

In `backend/src/app.js`, add the import (alongside the other route imports, e.g. after `leaderboardRoutes`):
```js
import departmentViolationRoutes from "./routes/departmentViolationRoutes.js";
```
and the mount (alongside the other `app.use("/api/...")` lines):
```js
app.use("/api/department-violations", departmentViolationRoutes);
```

- [ ] **Step 4: Write and run a smoke test for the migration + endpoint**

Append to `backend/scripts/smoke-department-scope.js`:

```js
  // --- Task 7: violations endpoint ---

  const violationsAsMember = await axios.get(`${BASE}/department-violations`, { ...memberA1.auth, validateStatus: () => true });
  assert.equal(violationsAsMember.status, 403, "only admin can read department violations");

  const violationsAsAdmin = await axios.get(`${BASE}/department-violations`, adminAuth);
  assert.equal(violationsAsAdmin.status, 200);
  assert.ok(Array.isArray(violationsAsAdmin.data.data.violations), "violations endpoint returns an array");
```

Run: `node --env-file=.env scripts/smoke-department-scope.js` — this only tests the endpoint shape (empty array is fine, since the migration script itself is run once, separately, not part of the smoke suite's fixture flow). Expected: PASS once Step 3's route is wired up.

Separately, verify the migration script itself works: run `node --env-file=.env scripts/migrate-manager-departments.js` against the real dev database once, by hand, and confirm its printed summary looks sane (some number of managers assigned/unresolved, some number of projects flagged, no thrown errors). This is a one-time operational verification, not a repeatable smoke assertion — the script is idempotent-ish (managers already having `managedDepartment` are skipped via the `managedDepartment: null` query filter) but re-running it will re-flag the same violations as duplicate `DepartmentViolation` rows, so don't run it more than once against the same data without clearing the collection first.

- [ ] **Step 5: Run the full smoke suite**

Same list plus `smoke-department-scope.js` itself.

- [ ] **Step 6: Commit**

```bash
git add src/models/DepartmentViolation.js scripts/migrate-manager-departments.js src/controllers/departmentViolationController.js src/routes/departmentViolationRoutes.js src/app.js scripts/smoke-department-scope.js
git commit -m "Add manager-department migration and a violations report endpoint"
```

---

### Task 8: Frontend violations report page

**Files:**
- Create: `frontend/services/departmentViolationService.js`
- Create: `frontend/app/(app)/admin/department-violations/page.js`

**Interfaces:**
- Consumes: `GET /department-violations` (Task 7).

- [ ] **Step 1: Add the service function**

Create `frontend/services/departmentViolationService.js`:

```js
import axiosInstance from "./axiosInstance";

export const fetchDepartmentViolations = async () => {
  const { data } = await axiosInstance.get("/department-violations");
  return data.data.violations;
};
```

- [ ] **Step 2: Create the admin page**

Create `frontend/app/(app)/admin/department-violations/page.js`, matching the existing `admin/leaderboard/page.js`'s admin-gate pattern:

```jsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, AlertTriangle } from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { fetchDepartmentViolations } from "@/services/departmentViolationService";
import { useAuthStore } from "@/store/authStore";

export default function DepartmentViolationsPage() {
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === "admin";

  const { data: violations = [], isLoading } = useQuery({
    queryKey: ["department-violations"],
    queryFn: fetchDepartmentViolations,
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <EmptyState icon={ShieldAlert} heading="Admins only" description="This section is restricted to admins." />
    );
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-card" />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-card border border-border bg-surface p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-warning" />
          <h3 className="text-base font-semibold tracking-tight">Cross-department projects</h3>
        </div>
        <p className="mt-1 text-sm text-muted">
          Projects flagged by the department-segregation migration as spanning more than one department. These
          existed before segregation was enforced and were left as-is — review and reassign members as needed.
        </p>
        {violations.length ? (
          <ul className="mt-4 space-y-2">
            {violations.map((v) => (
              <li key={v._id} className="rounded-input border border-border/60 bg-background/60 px-3 py-2 text-sm">
                <span className="font-medium">{v.project?.name || "Deleted project"}</span>
                <span className="ml-2 text-muted">
                  spans: {v.departments.map((d) => d.name).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">No cross-department projects flagged.</p>
        )}
      </section>
    </div>
  );
}
```

(No nav link is added — matching the existing `admin/leaderboard` page, which is also reached by direct URL only, per this codebase's current convention.)

- [ ] **Step 3: Manually verify**

`cd frontend && npm run dev` (pick a free port), confirm `/admin/department-violations` compiles cleanly (200, no errors in the dev log) both as a non-admin (should render the "Admins only" empty state — verify via reading the component logic and a curl-level check, since login-state-dependent UI can't be visually confirmed without browser automation) and reason through the admin path against a real `GET /department-violations` response once Task 7's migration has run.

- [ ] **Step 4: Commit**

```bash
git add services/departmentViolationService.js "app/(app)/admin/department-violations/page.js"
git commit -m "Add admin page for reviewing flagged cross-department projects"
```

---

## Self-Review Notes

- **Spec coverage:** every "Endpoint changes" item in the spec has a task — directory (2), leaderboard (3), org listing (4), manager visibility (5), createProject validation (6), migration (7), frontend (5, 8).
- **Type consistency checked:** `resolveDepartmentScope(user)` return shape (`null | {departmentId, teamIds, userIds}`) is used identically in Tasks 2, 3, 4, 6 — every consumer treats `null` as "unrestricted" and destructures the same three keys otherwise.
- **Known fixture-drift risk flagged inline:** Tasks 2, 5, and 6 each call out that existing smoke fixtures across other test files (created without a `team` or `managedDepartment`) may need small additions to keep passing once scoping tightens — this is expected friction from retrofitting segregation onto an already-permissive test suite, not a sign the new checks are wrong. Each task's Step 5/7 says explicitly: fix the fixture, don't loosen the check.
