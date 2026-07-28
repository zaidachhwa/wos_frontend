# Sub-Admin Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `subadmin` role that gets full admin-equivalent management rights (users, teams, projects/tasks/modules, dashboard, reports, leaderboard, AI workload/chat, calendar) restricted to one department and every team currently in it.

**Architecture:** One new field (`User.managedDepartment`) and one shared scope-resolution helper (`getManagedUserIds`) are threaded through every existing role-branch point in the backend (`admin` vs `manager`/`reportingManager`-scoped), adding a third `subadmin` branch that resolves to "every user on a team in my department." No new controllers, no schema changes beyond the one field.

**Tech Stack:** Express 5 + Mongoose (backend, all work), React/Next.js (frontend, Task 9 only). No new dependencies.

## Global Constraints

- Sub-admin never manages `admin` or `subadmin` accounts (can't create, edit, deactivate, or view them in listings) — role-capped per spec.
- Sub-admin never creates, renames, or deletes a Department — Department CRUD stays `admin`-only, no exceptions.
- Hard-deletion of a Project, Task, or Module stays `admin`-only (matches the codebase's existing extra caution around destructive actions, e.g. `wouldRemoveLastAdmin`) — sub-admin gets full create/read/update rights on these, not delete.
- No change to `manager`/`sublead`/`member` roles' existing behavior anywhere in this plan.
- Spec: `docs/superpowers/specs/2026-07-28-subadmin-role-design.md`

---

### Task 1: Role, data model, and core scope-resolution helper

**Files:**
- Modify: `backend/src/constants/roles.constants.js`
- Modify: `backend/src/models/User.js:12` (add field after `department`)
- Create: `backend/src/utils/subadminScope.js`
- Create: `backend/scripts/smoke-subadmin.js`
- Modify: `backend/package.json:10` (wire into the `smoke` chain)

**Interfaces:**
- Produces: `getManagedTeamIds(departmentId) => Promise<ObjectId[]>`, `getManagedUserIds(subadminUser) => Promise<ObjectId[]>`, `reportScopeFilter(user) => Promise<object>` (a Mongo filter, usable directly in `User.find(filter)`) — all exported from `backend/src/utils/subadminScope.js`. Every later task imports from this file; no task re-derives the department→team→user chain independently.

- [ ] **Step 1: Add the role**

In `backend/src/constants/roles.constants.js`, replace:

```js
export const ROLES = ["admin", "manager", "sublead", "member"];
```

with:

```js
export const ROLES = ["admin", "manager", "subadmin", "sublead", "member"];
```

- [ ] **Step 2: Add `managedDepartment` to the User model**

In `backend/src/models/User.js`, add after line 12 (`department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },`):

```js
    // Only set (and required, enforced in the controller, not here) when
    // role === "subadmin" — the one department a sub-admin manages. Their
    // managed teams are resolved dynamically from this (see subadminScope.js),
    // not stored, so a team added to the department later is covered
    // automatically without re-assigning the sub-admin.
    managedDepartment: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
```

- [ ] **Step 3: Write the core scope-resolution helper**

Create `backend/src/utils/subadminScope.js`:

```js
import Team from "../models/Team.js";
import User from "../models/User.js";

export const getManagedTeamIds = async (departmentId) => {
  const teams = await Team.find({ department: departmentId }, "_id");
  return teams.map((t) => t._id);
};

// Every user currently on any team in a sub-admin's managed department.
// Admin/subadmin accounts are excluded even if their team happens to sit in
// that department — sub-admins never manage other elevated accounts.
export const getManagedUserIds = async (subadminUser) => {
  const teamIds = await getManagedTeamIds(subadminUser.managedDepartment);
  const users = await User.find(
    { team: { $in: teamIds }, role: { $nin: ["admin", "subadmin"] } },
    "_id"
  );
  return users.map((u) => u._id);
};

// Shared by reportController.teamReport, aiController's workload/chat context
// builders — all three had the identical admin/manager ternary before this
// helper existed; this is that ternary generalized with a third branch.
export const reportScopeFilter = async (user) => {
  if (user.role === "admin") {
    return { role: { $ne: "admin" }, isActive: true };
  }
  if (user.role === "subadmin") {
    return { _id: { $in: await getManagedUserIds(user) }, isActive: true };
  }
  return { reportingManager: user._id, isActive: true };
};
```

- [ ] **Step 4: Wire the new smoke script into the suite**

In `backend/package.json`, add `&& node --env-file=.env scripts/smoke-subadmin.js` to the end of the `"smoke"` script string (line 10), after the existing `smoke-ai.js` entry.

- [ ] **Step 5: Write the first smoke assertions — the helper itself**

Create `backend/scripts/smoke-subadmin.js`:

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
  const email = `${role}+${Date.now()}+${Math.random().toString(36).slice(2)}@wos.local`;
  const password = "smokepass123";
  const res = await axios.post(
    `${BASE}/users`,
    { name: `Smoke ${role}`, email, password, role, ...extra },
    adminAuth
  );
  const login = await axios.post(`${BASE}/auth/login`, { email, password });
  return {
    userId: res.data.data.user._id,
    auth: { headers: { Authorization: `Bearer ${login.data.data.accessToken}` } },
  };
};

const run = async () => {
  const adminAuth = await authFor(EMAIL, PASSWORD);

  // --- fixture: one department with two teams, one team member each --------

  const dept = await axios.post(`${BASE}/departments`, { name: `Subadmin Smoke Dept ${Date.now()}` }, adminAuth);
  const deptId = dept.data.data.department._id;
  const otherDept = await axios.post(`${BASE}/departments`, { name: `Subadmin Smoke Other ${Date.now()}` }, adminAuth);
  const otherDeptId = otherDept.data.data.department._id;

  const teamA = await axios.post(`${BASE}/teams`, { name: `Team A ${Date.now()}`, department: deptId }, adminAuth);
  const teamAId = teamA.data.data.team._id;
  const teamB = await axios.post(`${BASE}/teams`, { name: `Team B ${Date.now()}`, department: deptId }, adminAuth);
  const teamBId = teamB.data.data.team._id;
  const otherTeam = await axios.post(
    `${BASE}/teams`,
    { name: `Other Team ${Date.now()}`, department: otherDeptId },
    adminAuth
  );
  const otherTeamId = otherTeam.data.data.team._id;

  const memberA = await createUser(adminAuth, "member", { team: teamAId, department: deptId });
  const memberB = await createUser(adminAuth, "member", { team: teamBId, department: deptId });
  const outsider = await createUser(adminAuth, "member", { team: otherTeamId, department: otherDeptId });

  const subadmin = await createUser(adminAuth, "subadmin", { managedDepartment: deptId });

  // --- helper correctness, exercised indirectly via the directory endpoint -
  // (getManagedUserIds itself is exercised by every later assertion in this
  // file; this first check just confirms the fixture wiring is sane before
  // building on it.)

  const directory = await axios.get(`${BASE}/users/directory`, adminAuth);
  const ids = directory.data.data.users.map((u) => u._id);
  assert.ok(ids.includes(memberA.userId), "fixture memberA exists");
  assert.ok(ids.includes(memberB.userId), "fixture memberB exists");
  assert.ok(ids.includes(outsider.userId), "fixture outsider exists in a different department");

  console.log("smoke-subadmin: all checks passed");
};

run().catch((error) => {
  console.error("smoke-subadmin failed:", error.response?.data?.message || error.message);
  process.exit(1);
});
```

This first pass only establishes the fixture (department/teams/users) that every later task's assertions build on — later tasks append real assertions about scoped behavior.

- [ ] **Step 6: Run the smoke suite and confirm it passes**

Run: `cd backend && npm run smoke`
Expected: every script prints its "all checks passed" line, ending with `smoke-subadmin: all checks passed`, exit code 0. (If `backend/.env` requires `GOOGLE_CLIENT_ID` to be set for `smoke-auth` to pass fully — it doesn't; that suite's assertions were already restructured around it being unset — no action needed there.)

- [ ] **Step 7: Commit**

```bash
git add backend/src/constants/roles.constants.js backend/src/models/User.js backend/src/utils/subadminScope.js backend/scripts/smoke-subadmin.js backend/package.json
git commit -m "feat: add subadmin role, managedDepartment field, and scope-resolution helper"
```

---

### Task 2: User management scoping

**Files:**
- Modify: `backend/src/routes/userRoutes.js`
- Modify: `backend/src/controllers/userController.js`
- Modify: `backend/src/validators/userValidators.js`
- Modify: `backend/scripts/smoke-subadmin.js` (append)

**Interfaces:**
- Consumes: `getManagedUserIds`, `getManagedTeamIds` from `backend/src/utils/subadminScope.js` (Task 1).

- [ ] **Step 1: Open the user routes to subadmin**

In `backend/src/routes/userRoutes.js`, replace lines 17-20:

```js
router.post("/", authorize("admin"), validateCreateUser, createUser);
router.get("/", authorize("admin"), listUsers);
router.patch("/:id", authorize("admin"), updateUser);
router.delete("/:id", authorize("admin"), deleteUser);
```

with:

```js
router.post("/", authorize("admin", "subadmin"), validateCreateUser, createUser);
router.get("/", authorize("admin", "subadmin"), listUsers);
router.patch("/:id", authorize("admin", "subadmin"), updateUser);
router.delete("/:id", authorize("admin", "subadmin"), deleteUser);
```

- [ ] **Step 2: Validate `managedDepartment` on create when role is subadmin**

In `backend/src/validators/userValidators.js`, replace the whole file:

```js
import { ROLES } from "../constants/roles.constants.js";

export const validateCreateUser = (req, res, next) => {
  const { name, email, password, role, managedDepartment } = req.body;
  if (!name || !email || !password || !role) {
    return res
      .status(400)
      .json({ success: false, message: "name, email, password and role are required" });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Invalid email" });
  }
  if (String(password).length < 8) {
    return res
      .status(400)
      .json({ success: false, message: "Password must be at least 8 characters" });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: "Invalid role" });
  }
  if (role === "subadmin" && !managedDepartment) {
    return res
      .status(400)
      .json({ success: false, message: "managedDepartment is required for the subadmin role" });
  }
  next();
};
```

- [ ] **Step 3: Scope `createUser`, `listUsers`, `updateUser`, `deleteUser` in the controller**

In `backend/src/controllers/userController.js`, add the import after line 4 (`import { paginationParams, paginationMeta } from "../utils/pagination.js";`):

```js
import { getManagedTeamIds, getManagedUserIds } from "../utils/subadminScope.js";
```

Replace `createUser` (lines 21-47):

```js
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, designation, department, team, reportingManager, managedDepartment } =
      req.body;

    if (req.user.role === "subadmin") {
      if (["admin", "subadmin"].includes(role)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      const managedTeamIds = (await getManagedTeamIds(req.user.managedDepartment)).map(String);
      if (!team || !managedTeamIds.includes(String(team))) {
        return res
          .status(403)
          .json({ success: false, message: "team must be one of your managed teams" });
      }
    }

    const existing = await User.findOne({ email: String(email).toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: "Email already in use" });
    }
    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role,
      designation,
      department: req.user.role === "subadmin" ? req.user.managedDepartment : department || null,
      team: team || null,
      reportingManager: reportingManager || null,
      managedDepartment: role === "subadmin" ? managedDepartment : null,
    });
    const safeUser = await User.findById(user._id);
    return res.status(201).json({ success: true, message: "User created", data: { user: safeUser } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already in use" });
    }
    return res.status(400).json({ success: false, message: error.message });
  }
};
```

Replace `listUsers` (lines 49-65):

```js
export const listUsers = async (req, res) => {
  try {
    const pageParams = paginationParams(req.query);
    const baseFilter =
      req.user.role === "subadmin"
        ? { _id: { $in: await getManagedUserIds(req.user) } }
        : {};
    const total = await User.countDocuments(baseFilter);
    let query = User.find(baseFilter).populate("department team reportingManager", "name email");
    if (pageParams) query = query.skip(pageParams.skip).limit(pageParams.limit);
    const users = await query;
    return res.json({
      success: true,
      message: "Users fetched",
      data: { users, pagination: paginationMeta(total, pageParams) },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
```

Replace `updateUser` (lines 80-112):

```js
export const updateUser = async (req, res) => {
  try {
    const allowed = [
      "name",
      "designation",
      "role",
      "department",
      "team",
      "reportingManager",
      "isActive",
    ];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (req.user.role === "subadmin") {
      if (["admin", "subadmin"].includes(target.role)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      if (updates.role && ["admin", "subadmin"].includes(updates.role)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      const managedUserIds = (await getManagedUserIds(req.user)).map(String);
      if (!managedUserIds.includes(String(target._id))) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      if (updates.team) {
        const managedTeamIds = (await getManagedTeamIds(req.user.managedDepartment)).map(String);
        if (!managedTeamIds.includes(String(updates.team))) {
          return res
            .status(403)
            .json({ success: false, message: "team must be one of your managed teams" });
        }
      }
    }

    if (await wouldRemoveLastAdmin(target, updates)) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot remove the last active admin" });
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    return res.json({ success: true, message: "User updated", data: { user } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
```

Replace `deleteUser` (lines 114-131):

```js
export const deleteUser = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (req.user.role === "subadmin") {
      if (["admin", "subadmin"].includes(target.role)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      const managedUserIds = (await getManagedUserIds(req.user)).map(String);
      if (!managedUserIds.includes(String(target._id))) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
    }

    if (await wouldRemoveLastAdmin(target, { isActive: false })) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot remove the last active admin" });
    }
    target.isActive = false;
    await target.save();
    return res.json({ success: true, message: "User deleted", data: { user: target } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
```

- [ ] **Step 4: Append smoke assertions**

In `backend/scripts/smoke-subadmin.js`, replace the closing block (from the `console.log("smoke-subadmin: all checks passed");` line onward) so the new assertions land before it:

```js
  // --- subadmin: list is restricted to managed department's users ----------

  const listAsSubadmin = await axios.get(`${BASE}/users`, subadmin.auth);
  assert.equal(listAsSubadmin.status, 200, "subadmin can list users");
  const listedIds = listAsSubadmin.data.data.users.map((u) => String(u._id));
  assert.ok(listedIds.includes(memberA.userId), "subadmin's list includes memberA (their department)");
  assert.ok(!listedIds.includes(outsider.userId), "subadmin's list excludes outsider (different department)");
  assert.ok(!listedIds.some((id) => id === String(subadmin.userId)), "subadmin's list excludes admin/subadmin accounts")

  // --- subadmin: create user in a managed team OK, outside team forbidden --

  const createInScope = await axios.post(
    `${BASE}/users`,
    {
      name: "Subadmin-created",
      email: `subadmincreated+${Date.now()}@wos.local`,
      password: "smokepass123",
      role: "member",
      team: teamAId,
    },
    subadmin.auth
  );
  assert.equal(createInScope.status, 201, "subadmin creates a user on their own managed team");

  const createOutOfScope = await axios.post(
    `${BASE}/users`,
    {
      name: "Should fail",
      email: `shouldfail+${Date.now()}@wos.local`,
      password: "smokepass123",
      role: "member",
      team: otherTeamId,
    },
    { ...subadmin.auth, validateStatus: () => true }
  );
  assert.equal(createOutOfScope.status, 403, "subadmin cannot create a user on a team outside their department");

  const createAdminForbidden = await axios.post(
    `${BASE}/users`,
    {
      name: "Should fail",
      email: `shouldfail2+${Date.now()}@wos.local`,
      password: "smokepass123",
      role: "admin",
      team: teamAId,
    },
    { ...subadmin.auth, validateStatus: () => true }
  );
  assert.equal(createAdminForbidden.status, 403, "subadmin cannot create a user with role admin");

  // --- subadmin: update/deactivate in scope OK, out of scope forbidden -----

  const updateInScope = await axios.patch(
    `${BASE}/users/${memberA.userId}`,
    { designation: "Updated by subadmin" },
    subadmin.auth
  );
  assert.equal(updateInScope.status, 200, "subadmin updates a user in their managed department");

  const updateOutOfScope = await axios.patch(
    `${BASE}/users/${outsider.userId}`,
    { designation: "Should fail" },
    { ...subadmin.auth, validateStatus: () => true }
  );
  assert.equal(updateOutOfScope.status, 404, "subadmin cannot update a user outside their department");

  const updateAdminForbidden = await axios.patch(
    `${BASE}/users/${subadmin.userId}`,
    { designation: "Should fail" },
    { ...subadmin.auth, validateStatus: () => true }
  );
  assert.equal(updateAdminForbidden.status, 403, "subadmin cannot update another subadmin's own account");

  const moveOutOfManagedTeam = await axios.patch(
    `${BASE}/users/${memberA.userId}`,
    { team: otherTeamId },
    { ...subadmin.auth, validateStatus: () => true }
  );
  assert.equal(moveOutOfManagedTeam.status, 403, "subadmin cannot move a user to a team outside their department");

  const deactivateOutOfScope = await axios.delete(`${BASE}/users/${outsider.userId}`, {
    ...subadmin.auth,
    validateStatus: () => true,
  });
  assert.equal(deactivateOutOfScope.status, 404, "subadmin cannot deactivate a user outside their department");

  const deactivateInScope = await axios.delete(`${BASE}/users/${memberB.userId}`, subadmin.auth);
  assert.equal(deactivateInScope.status, 200, "subadmin deactivates a user in their managed department");

  // --- managedDepartment is required when creating a subadmin --------------

  const subadminMissingDept = await axios.post(
    `${BASE}/users`,
    {
      name: "Should fail",
      email: `subadminnodept+${Date.now()}@wos.local`,
      password: "smokepass123",
      role: "subadmin",
    },
    { ...adminAuth, validateStatus: () => true }
  );
  assert.equal(subadminMissingDept.status, 400, "creating a subadmin without managedDepartment is rejected");

  console.log("smoke-subadmin: all checks passed");
};

run().catch((error) => {
  console.error("smoke-subadmin failed:", error.response?.data?.message || error.message);
  process.exit(1);
});
```

- [ ] **Step 5: Run the smoke suite**

Run: `cd backend && npm run smoke`
Expected: `smoke-subadmin: all checks passed`, full chain exit 0.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/userRoutes.js backend/src/controllers/userController.js backend/src/validators/userValidators.js backend/scripts/smoke-subadmin.js
git commit -m "feat: scope user management (create/list/update/deactivate) to a subadmin's department"
```

---

### Task 3: Team management scoping

**Files:**
- Modify: `backend/src/routes/orgRoutes.js`
- Modify: `backend/src/controllers/orgController.js`
- Modify: `backend/scripts/smoke-subadmin.js` (append)

**Interfaces:**
- Consumes: nothing new from earlier tasks (Team CRUD scoping only needs `req.user.managedDepartment` directly, no `subadminScope.js` helper call needed since it's a direct department-id comparison).

- [ ] **Step 1: Open Team routes (not Department routes) to subadmin**

In `backend/src/routes/orgRoutes.js`, replace lines 26-28:

```js
teamRouter.post("/", authorize("admin"), validateTeamCreate, createTeam);
teamRouter.patch("/:id", authorize("admin"), updateTeam);
teamRouter.delete("/:id", authorize("admin"), deleteTeam);
```

with:

```js
teamRouter.post("/", authorize("admin", "subadmin"), validateTeamCreate, createTeam);
teamRouter.patch("/:id", authorize("admin", "subadmin"), updateTeam);
teamRouter.delete("/:id", authorize("admin", "subadmin"), deleteTeam);
```

Department routes (lines 19-21) are unchanged — Department CRUD stays `admin`-only.

- [ ] **Step 2: Scope `createTeam`, `updateTeam`, `deleteTeam` to the caller's managed department**

In `backend/src/controllers/orgController.js`, replace `createTeam` (lines 62-76):

```js
export const createTeam = async (req, res) => {
  try {
    const { name, department } = req.body;
    if (req.user.role === "subadmin" && String(department) !== String(req.user.managedDepartment)) {
      return res
        .status(403)
        .json({ success: false, message: "You may only create teams in your managed department" });
    }
    const dept = await Department.findById(department);
    if (!dept) {
      return res
        .status(400)
        .json({ success: false, message: "department must reference an existing department" });
    }
    const team = await Team.create({ name, department });
    return res.status(201).json({ success: true, message: "Team created", data: { team } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
```

Replace `updateTeam` (lines 88-113):

```js
export const updateTeam = async (req, res) => {
  try {
    const existing = await Team.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }
    if (req.user.role === "subadmin") {
      if (String(existing.department) !== String(req.user.managedDepartment)) {
        return res.status(404).json({ success: false, message: "Team not found" });
      }
      if (req.body.department && String(req.body.department) !== String(req.user.managedDepartment)) {
        return res
          .status(403)
          .json({ success: false, message: "You may only manage teams in your managed department" });
      }
    }

    const updates = {};
    for (const key of ["name", "department"]) {
      if (key in req.body) updates[key] = req.body[key];
    }
    if (updates.department) {
      const dept = await Department.findById(updates.department);
      if (!dept) {
        return res
          .status(400)
          .json({ success: false, message: "department must reference an existing department" });
      }
    }
    const team = await Team.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    return res.json({ success: true, message: "Team updated", data: { team } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
```

Replace `deleteTeam` (lines 115-126):

```js
export const deleteTeam = async (req, res) => {
  try {
    const existing = await Team.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }
    if (
      req.user.role === "subadmin" &&
      String(existing.department) !== String(req.user.managedDepartment)
    ) {
      return res.status(404).json({ success: false, message: "Team not found" });
    }
    const team = await Team.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: "Team deleted", data: null });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
```

- [ ] **Step 3: Append smoke assertions**

In `backend/scripts/smoke-subadmin.js`, insert before the final `console.log("smoke-subadmin: all checks passed");`:

```js
  // --- subadmin: team CRUD scoped to their managed department --------------

  const teamCreateInScope = await axios.post(
    `${BASE}/teams`,
    { name: `Subadmin Team ${Date.now()}`, department: deptId },
    subadmin.auth
  );
  assert.equal(teamCreateInScope.status, 201, "subadmin creates a team in their managed department");
  const subadminTeamId = teamCreateInScope.data.data.team._id;

  const teamCreateOutOfScope = await axios.post(
    `${BASE}/teams`,
    { name: "Should fail", department: otherDeptId },
    { ...subadmin.auth, validateStatus: () => true }
  );
  assert.equal(teamCreateOutOfScope.status, 403, "subadmin cannot create a team in a different department");

  const teamUpdateInScope = await axios.patch(
    `${BASE}/teams/${subadminTeamId}`,
    { name: "Renamed by subadmin" },
    subadmin.auth
  );
  assert.equal(teamUpdateInScope.status, 200, "subadmin renames a team in their managed department");

  const teamUpdateOutOfScope = await axios.patch(
    `${BASE}/teams/${otherTeamId}`,
    { name: "Should fail" },
    { ...subadmin.auth, validateStatus: () => true }
  );
  assert.equal(teamUpdateOutOfScope.status, 404, "subadmin cannot update a team in a different department");

  const teamDeleteOutOfScope = await axios.delete(`${BASE}/teams/${otherTeamId}`, {
    ...subadmin.auth,
    validateStatus: () => true,
  });
  assert.equal(teamDeleteOutOfScope.status, 404, "subadmin cannot delete a team in a different department");

  const teamDeleteInScope = await axios.delete(`${BASE}/teams/${subadminTeamId}`, subadmin.auth);
  assert.equal(teamDeleteInScope.status, 200, "subadmin deletes a team in their managed department");

  // --- subadmin: Department CRUD stays forbidden ----------------------------

  const deptCreateForbidden = await axios.post(
    `${BASE}/departments`,
    { name: "Should fail" },
    { ...subadmin.auth, validateStatus: () => true }
  );
  assert.equal(deptCreateForbidden.status, 403, "subadmin cannot create a department");

  const deptDeleteForbidden = await axios.delete(`${BASE}/departments/${deptId}`, {
    ...subadmin.auth,
    validateStatus: () => true,
  });
  assert.equal(deptDeleteForbidden.status, 403, "subadmin cannot delete their own managed department");

  console.log("smoke-subadmin: all checks passed");
};

run().catch((error) => {
  console.error("smoke-subadmin failed:", error.response?.data?.message || error.message);
  process.exit(1);
});
```

- [ ] **Step 4: Run the smoke suite**

Run: `cd backend && npm run smoke`
Expected: `smoke-subadmin: all checks passed`, full chain exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/orgRoutes.js backend/src/controllers/orgController.js backend/scripts/smoke-subadmin.js
git commit -m "feat: scope Team CRUD to a subadmin's managed department, keep Department CRUD admin-only"
```

---

### Task 4: Project / Task / Module scoping

**Files:**
- Modify: `backend/src/controllers/projectController.js`
- Modify: `backend/src/routes/projectRoutes.js`
- Modify: `backend/src/controllers/taskController.js:12`
- Modify: `backend/src/routes/taskRoutes.js`
- Modify: `backend/scripts/smoke-subadmin.js` (append)

**Interfaces:**
- Consumes: `getManagedUserIds` from `backend/src/utils/subadminScope.js` (Task 1).
- Produces: `canManage`, `canViewProject`, `visibilityFilter` in `projectController.js` all gain subadmin-awareness — `taskController.js`, `moduleController.js`, `dashboardController.js`, `aiController.js` (all later tasks/existing code) consume these unchanged by name, so their subadmin support comes for free once this task lands.

- [ ] **Step 1: Generalize `canManage`, `canViewProject`, `visibilityFilter`**

In `backend/src/controllers/projectController.js`, add the import after line 6 (`import { paginationParams, paginationMeta } from "../utils/pagination.js";`):

```js
import { getManagedUserIds } from "../utils/subadminScope.js";
```

Replace lines 13-40:

```js
const canManage = async (user, project) => {
  if (["admin", "manager"].includes(user.role)) return true;
  if (idOf(project.manager) === String(user._id)) return true;
  if (user.role === "subadmin") {
    const managedIds = (await getManagedUserIds(user)).map(String);
    return managedIds.includes(idOf(project.manager));
  }
  return false;
};

// Exported for moduleController/taskController: same visibility rule applies
// to viewing a project's modules/tasks.
export const canViewProject = async (user, project) => {
  if (["admin", "manager"].includes(user.role)) return true;
  if (idOf(project.manager) === String(user._id)) return true;
  if ((project.members || []).some((m) => idOf(m) === String(user._id))) return true;
  if (user.role === "subadmin") {
    const managedIds = (await getManagedUserIds(user)).map(String);
    if (managedIds.includes(idOf(project.manager))) return true;
    if ((project.members || []).some((m) => managedIds.includes(idOf(m)))) return true;
  }
  const assignedToAModule = await ProjectModule.exists({ project: project._id, assignees: user._id });
  if (assignedToAModule) return true;
  const assignedToATask = await Task.exists({ project: project._id, assignees: user._id });
  return !!assignedToATask;
};

// Exported for taskController: build a Project filter matching what a user
// may view, so task list filtering doesn't duplicate the visibility rule.
export const visibilityFilter = async (user) => {
  if (["admin", "manager"].includes(user.role)) return {};
  const scopeIds = user.role === "subadmin" ? await getManagedUserIds(user) : [user._id];
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

- [ ] **Step 2: Update `canManage`'s one call site to `await` it**

In `backend/src/controllers/projectController.js`, in `updateProject`, replace:

```js
    if (!canManage(req.user, project)) {
```

with:

```js
    if (!(await canManage(req.user, project))) {
```

- [ ] **Step 3: Open project/module create+list routes to subadmin**

In `backend/src/routes/projectRoutes.js`, replace lines 22-23:

```js
router.get("/", listProjects);
router.post("/", authorize("admin", "manager"), validateProjectCreate, createProject);
```

with:

```js
router.get("/", listProjects);
router.post("/", authorize("admin", "manager", "subadmin"), validateProjectCreate, createProject);
```

Replace lines 31-37:

```js
router.post(
  "/:projectId/modules",
  authorize("admin", "manager", "sublead"),
  validateModuleCreate,
  createModule
);
router.patch("/:projectId/modules/:id", authorize("admin", "manager", "sublead"), updateModule);
```

with:

```js
router.post(
  "/:projectId/modules",
  authorize("admin", "manager", "subadmin", "sublead"),
  validateModuleCreate,
  createModule
);
router.patch("/:projectId/modules/:id", authorize("admin", "manager", "subadmin", "sublead"), updateModule);
```

`deleteProject` (line 28) and `deleteModule` (line 38) stay `authorize("admin")` only, per this plan's Global Constraints.

- [ ] **Step 4: Give subadmin full task-management fields, within their existing project-scope check**

In `backend/src/controllers/taskController.js`, replace line 12:

```js
const SUBLEAD_PLUS = ["admin", "manager", "sublead"];
```

with:

```js
const SUBLEAD_PLUS = ["admin", "manager", "subadmin", "sublead"];
```

This is the only change needed in this file — `updateTask`'s `canManageFully` (line 332) already re-checks `canViewProject(req.user, project)`, which Step 1 already made subadmin-aware, so a subadmin only gets full-field task editing on tasks in projects within their own department. `updateComment`/`deleteComment` (lines 518, 545) deliberately do NOT get `subadmin` added — those two actions have no project-scope check for any role today (a bug pre-dating this plan, out of scope to fix here), and adding subadmin to them would grant unscoped cross-department comment moderation, which this plan doesn't intend.

- [ ] **Step 5: Open task create/bulk-update routes to subadmin**

In `backend/src/routes/taskRoutes.js`, replace lines 23 and 25:

```js
router.post("/", authorize("admin", "manager", "sublead", "member"), validateTaskCreate, createTask);
// Must come before "/:id" — otherwise Express matches "bulk" as the :id param.
router.patch("/bulk", authorize("admin", "manager", "sublead"), bulkUpdateTasks);
```

with:

```js
router.post("/", authorize("admin", "manager", "subadmin", "sublead", "member"), validateTaskCreate, createTask);
// Must come before "/:id" — otherwise Express matches "bulk" as the :id param.
router.patch("/bulk", authorize("admin", "manager", "subadmin", "sublead"), bulkUpdateTasks);
```

`deleteTask` (line 33) stays `authorize("admin")` only, per Global Constraints.

- [ ] **Step 6: Append smoke assertions**

In `backend/scripts/smoke-subadmin.js`, insert before the final `console.log`:

```js
  // --- subadmin: project visibility follows manager/member overlap ---------

  const projectInScope = await axios.post(
    `${BASE}/projects`,
    { name: `Subadmin Smoke Project ${Date.now()}`, manager: memberA.userId, type: "internal" },
    subadmin.auth
  );
  assert.equal(projectInScope.status, 201, "subadmin creates a project managed by memberA (in scope)");
  const projectInScopeId = projectInScope.data.data.project._id;

  const projectOutOfScope = await axios.post(
    `${BASE}/projects`,
    { name: `Outside Project ${Date.now()}`, manager: outsider.userId, type: "internal" },
    adminAuth
  );
  const projectOutOfScopeId = projectOutOfScope.data.data.project._id;

  const projectListAsSubadmin = await axios.get(`${BASE}/projects`, subadmin.auth);
  const visibleProjectIds = projectListAsSubadmin.data.data.projects.map((p) => String(p._id));
  assert.ok(visibleProjectIds.includes(String(projectInScopeId)), "subadmin sees the in-scope project");
  assert.ok(!visibleProjectIds.includes(String(projectOutOfScopeId)), "subadmin does not see the out-of-scope project");

  const getOutOfScopeProject = await axios.get(`${BASE}/projects/${projectOutOfScopeId}`, {
    ...subadmin.auth,
    validateStatus: () => true,
  });
  assert.equal(getOutOfScopeProject.status, 403, "subadmin is forbidden from fetching the out-of-scope project directly");

  // --- subadmin: task creation/visibility follows the same project scope ---

  const taskInScope = await axios.post(
    `${BASE}/tasks`,
    { project: projectInScopeId, title: "Subadmin smoke task", assignees: [memberA.userId] },
    subadmin.auth
  );
  assert.equal(taskInScope.status, 201, "subadmin creates a task in an in-scope project");

  const taskOutOfScope = await axios.post(
    `${BASE}/tasks`,
    { project: projectOutOfScopeId, title: "Should fail", assignees: [outsider.userId] },
    { ...subadmin.auth, validateStatus: () => true }
  );
  assert.equal(taskOutOfScope.status, 403, "subadmin cannot create a task in an out-of-scope project");

  console.log("smoke-subadmin: all checks passed");
};

run().catch((error) => {
  console.error("smoke-subadmin failed:", error.response?.data?.message || error.message);
  process.exit(1);
});
```

- [ ] **Step 7: Run the smoke suite**

Run: `cd backend && npm run smoke`
Expected: `smoke-subadmin: all checks passed`, full chain exit 0. Also re-confirm `smoke-projects.js` and `smoke-tasks-extra.js` still pass unmodified — the `canManage`/`canViewProject`/`visibilityFilter` signature changes must not alter behavior for admin/manager/sublead/member.

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/projectController.js backend/src/routes/projectRoutes.js backend/src/controllers/taskController.js backend/src/routes/taskRoutes.js backend/scripts/smoke-subadmin.js
git commit -m "feat: scope project/task/module visibility and management to a subadmin's department"
```

---

### Task 5: Dashboard + Reports scoping

**Files:**
- Modify: `backend/src/controllers/dashboardController.js`
- Modify: `backend/src/controllers/reportController.js`
- Modify: `backend/src/routes/reportRoutes.js`
- Modify: `backend/scripts/smoke-subadmin.js` (append)

**Interfaces:**
- Consumes: `reportScopeFilter` from `backend/src/utils/subadminScope.js` (Task 1); `visibilityFilter` from `projectController.js` (already subadmin-aware per Task 4).

- [ ] **Step 1: Dashboard's "reports" list uses the managed-user-set for a subadmin**

In `backend/src/controllers/dashboardController.js`, add the import after line 8 (`import { visibilityFilter } from "./projectController.js";`):

```js
import { getManagedUserIds } from "../utils/subadminScope.js";
```

In `managerLikeDashboard`, replace line 58:

```js
    User.find({ reportingManager: user._id, isActive: true }).select("name role"),
```

with:

```js
    user.role === "subadmin"
      ? User.find({ _id: { $in: await getManagedUserIds(user) }, isActive: true }).select("name role")
      : User.find({ reportingManager: user._id, isActive: true }).select("name role"),
```

Line 54's `projectFilter` ternary (`user.role === "manager" ? { manager: user._id } : await visibilityFilter(user)`) and `getDashboard`'s dispatch (line 188-190, `else data = await managerLikeDashboard(req.user)`) need no changes — subadmin already falls into the `managerLikeDashboard` else-branch (it's neither `"admin"` nor `"member"`), and `visibilityFilter` is already subadmin-aware from Task 4.

- [ ] **Step 2: Reports use the shared `reportScopeFilter` helper**

In `backend/src/controllers/reportController.js`, add the import after line 3 (`import User from "../models/User.js";`):

```js
import { reportScopeFilter } from "../utils/subadminScope.js";
```

Replace lines 51-54:

```js
    const reportFilter =
      req.user.role === "admin"
        ? { role: { $ne: "admin" }, isActive: true }
        : { reportingManager: req.user._id, isActive: true };
```

with:

```js
    const reportFilter = await reportScopeFilter(req.user);
```

- [ ] **Step 3: Open the reports route to subadmin**

In `backend/src/routes/reportRoutes.js`, replace line 9:

```js
router.get("/team", authorize("admin", "manager"), teamReport);
```

with:

```js
router.get("/team", authorize("admin", "manager", "subadmin"), teamReport);
```

- [ ] **Step 4: Append smoke assertions**

In `backend/scripts/smoke-subadmin.js`, insert before the final `console.log`:

```js
  // --- subadmin: dashboard "reports" is the managed-user-set ---------------

  const dashboardAsSubadmin = await axios.get(`${BASE}/dashboard`, subadmin.auth);
  assert.equal(dashboardAsSubadmin.status, 200, "subadmin fetches their dashboard");
  const dashboardReportIds = dashboardAsSubadmin.data.data.workload.map((w) => String(w.user._id));
  assert.ok(dashboardReportIds.includes(memberA.userId), "subadmin's dashboard workload includes memberA");
  assert.ok(!dashboardReportIds.includes(outsider.userId), "subadmin's dashboard workload excludes outsider");

  // --- subadmin: team report is scoped to the managed department -----------

  const today = new Date().toISOString().slice(0, 10);
  const reportAsSubadmin = await axios.get(
    `${BASE}/reports/team?from=${today}&to=${today}`,
    subadmin.auth
  );
  assert.equal(reportAsSubadmin.status, 200, "subadmin fetches the team report");
  const reportUserIds = reportAsSubadmin.data.data.rows.map((r) => String(r.user._id));
  assert.ok(reportUserIds.includes(memberA.userId), "subadmin's report includes memberA");
  assert.ok(!reportUserIds.includes(outsider.userId), "subadmin's report excludes outsider");

  console.log("smoke-subadmin: all checks passed");
};

run().catch((error) => {
  console.error("smoke-subadmin failed:", error.response?.data?.message || error.message);
  process.exit(1);
});
```

- [ ] **Step 5: Run the smoke suite**

Run: `cd backend && npm run smoke`
Expected: `smoke-subadmin: all checks passed`, full chain exit 0. Also confirm `smoke-dashboard.js` still passes unmodified.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/dashboardController.js backend/src/controllers/reportController.js backend/src/routes/reportRoutes.js backend/scripts/smoke-subadmin.js
git commit -m "feat: scope dashboard reports-list and team report to a subadmin's department"
```

---

### Task 6: Leaderboard scoping

**Files:**
- Modify: `backend/src/controllers/leaderboardController.js`
- Modify: `backend/scripts/smoke-subadmin.js` (append)

**Interfaces:**
- Consumes: `getManagedTeamIds` from `backend/src/utils/subadminScope.js` (Task 1).

- [ ] **Step 1: Restrict the roster and extend CSV/lock-bypass rights**

In `backend/src/controllers/leaderboardController.js`, add the import after line 5 (`import { getPointsByPriority, setPointsByPriority } from "../utils/pointsConfig.js";`):

```js
import { getManagedTeamIds } from "../utils/subadminScope.js";
```

Replace line 26:

```js
const REPORT_ROLES = ["admin", "manager"];
```

with:

```js
const REPORT_ROLES = ["admin", "manager", "subadmin"];
```

Replace lines 58-59:

```js
    const rosterFilter = { isActive: true, role: { $ne: "admin" } };
    if (req.query.team) rosterFilter.team = req.query.team;
```

with:

```js
    const rosterFilter = { isActive: true, role: { $ne: "admin" } };
    if (req.user.role === "subadmin") {
      const managedTeamIds = (await getManagedTeamIds(req.user.managedDepartment)).map(String);
      if (req.query.team) {
        if (!managedTeamIds.includes(String(req.query.team))) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }
        rosterFilter.team = req.query.team;
      } else {
        rosterFilter.team = { $in: managedTeamIds };
      }
    } else if (req.query.team) {
      rosterFilter.team = req.query.team;
    }
```

- [ ] **Step 2: Append smoke assertions**

In `backend/scripts/smoke-subadmin.js`, insert before the final `console.log`:

```js
  // --- subadmin: leaderboard roster restricted to the managed department ---

  const leaderboardAsSubadmin = await axios.get(`${BASE}/leaderboard`, subadmin.auth);
  assert.equal(leaderboardAsSubadmin.status, 200, "subadmin fetches the leaderboard");
  if (!leaderboardAsSubadmin.data.data.locked) {
    const rosterIds = leaderboardAsSubadmin.data.data.rows.map((r) => String(r.user._id));
    assert.ok(rosterIds.includes(memberA.userId), "subadmin's leaderboard roster includes memberA");
    assert.ok(!rosterIds.includes(outsider.userId), "subadmin's leaderboard roster excludes outsider");
  }

  const leaderboardTeamOutOfScope = await axios.get(`${BASE}/leaderboard?team=${otherTeamId}`, {
    ...subadmin.auth,
    validateStatus: () => true,
  });
  assert.ok(
    [200, 403].includes(leaderboardTeamOutOfScope.status) &&
      (leaderboardTeamOutOfScope.status !== 200 || leaderboardTeamOutOfScope.data.data.locked),
    "subadmin cannot use ?team= to view a team outside their department"
  );

  console.log("smoke-subadmin: all checks passed");
};

run().catch((error) => {
  console.error("smoke-subadmin failed:", error.response?.data?.message || error.message);
  process.exit(1);
});
```

Note on the last assertion: the leaderboard is Monday-locked for non-admin roles (see `bypassLock` in the controller) — the assertion accepts either a `403` (out-of-scope `?team=` rejected) or a `200` with `locked: true` (rejected before the scope check runs at all, if the smoke suite happens to run on a non-Monday), so it's correct on every day of the week.

- [ ] **Step 3: Run the smoke suite**

Run: `cd backend && npm run smoke`
Expected: `smoke-subadmin: all checks passed`, full chain exit 0. Also confirm `smoke-leaderboard.js` still passes unmodified.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/leaderboardController.js backend/scripts/smoke-subadmin.js
git commit -m "feat: scope leaderboard roster and CSV/lock-bypass rights to a subadmin's department"
```

---

### Task 7: AI (workload + chat) scoping

**Files:**
- Modify: `backend/src/controllers/aiController.js`
- Modify: `backend/src/routes/aiRoutes.js`
- Modify: `backend/scripts/smoke-subadmin.js` (append)

**Interfaces:**
- Consumes: `reportScopeFilter` from `backend/src/utils/subadminScope.js` (Task 1).

- [ ] **Step 1: `workloadContext` and `chat`'s reports block use the shared helper**

In `backend/src/controllers/aiController.js`, add the import after line 10 (`import { isTaskOverdue } from "../utils/taskDates.js";`):

```js
import { reportScopeFilter } from "../utils/subadminScope.js";
```

Replace lines 60-64 (inside `workloadContext`):

```js
const workloadContext = async (user) => {
  const reportFilter =
    user.role === "admin"
      ? { role: { $ne: "admin" }, isActive: true }
      : { reportingManager: user._id, isActive: true };
  const reports = await User.find(reportFilter).select("name role");
```

with:

```js
const workloadContext = async (user) => {
  const reportFilter = await reportScopeFilter(user);
  const reports = await User.find(reportFilter).select("name role");
```

In `chat`, replace line 176:

```js
    if (["admin", "manager", "sublead"].includes(req.user.role)) {
```

with:

```js
    if (["admin", "manager", "subadmin", "sublead"].includes(req.user.role)) {
```

and replace lines 178-181:

```js
      const reportFilter =
        req.user.role === "admin"
          ? { role: { $ne: "admin" }, isActive: true }
          : { reportingManager: req.user._id, isActive: true };
```

with:

```js
      const reportFilter = await reportScopeFilter(req.user);
```

- [ ] **Step 2: Open the workload route to subadmin**

In `backend/src/routes/aiRoutes.js`, replace line 11:

```js
router.post("/workload", authorize("admin", "manager"), workloadAnalysis);
```

with:

```js
router.post("/workload", authorize("admin", "manager", "subadmin"), workloadAnalysis);
```

`/daily-planner`, `/project-health`, and `/chat` have no role restriction (already open to all authenticated roles, self- or `canViewProject`-scoped) — no route change needed for them; `chat`'s internal role check (Step 1) is the only gate that mattered.

- [ ] **Step 3: Append smoke assertions**

In `backend/scripts/smoke-subadmin.js`, insert before the final `console.log`. These endpoints require `GEMINI_API_KEY` to be configured (they 503 otherwise, per `requireAI`) — guard the assertions so this file still passes in an environment without a real Gemini key configured:

```js
  // --- subadmin: AI workload analysis is reachable (scoping is internal to
  // the prompt context sent to Gemini, not independently observable from the
  // response text — this just confirms the route/role-gate wiring is correct) --

  const workloadAsSubadmin = await axios.post(
    `${BASE}/ai/workload`,
    {},
    { ...subadmin.auth, validateStatus: () => true }
  );
  assert.ok(
    [200, 503].includes(workloadAsSubadmin.status),
    "subadmin can reach the AI workload endpoint (200 if Gemini is configured, 503 if AI isn't configured — both prove the role gate didn't 403)"
  );

  console.log("smoke-subadmin: all checks passed");
};

run().catch((error) => {
  console.error("smoke-subadmin failed:", error.response?.data?.message || error.message);
  process.exit(1);
});
```

- [ ] **Step 4: Run the smoke suite**

Run: `cd backend && npm run smoke`
Expected: `smoke-subadmin: all checks passed`, full chain exit 0. Also confirm `smoke-ai.js` still passes unmodified.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/aiController.js backend/src/routes/aiRoutes.js backend/scripts/smoke-subadmin.js
git commit -m "feat: scope AI workload analysis and chat context to a subadmin's department"
```

---

### Task 8: Calendar (acting for another user) scoping

**Files:**
- Modify: `backend/src/controllers/timeblockController.js`
- Modify: `backend/scripts/smoke-subadmin.js` (append)

**Interfaces:**
- Consumes: `getManagedUserIds` from `backend/src/utils/subadminScope.js` (Task 1).

- [ ] **Step 1: Extend `canActForUser`**

In `backend/src/controllers/timeblockController.js`, add the import after line 2 (`import User from "../models/User.js";`):

```js
import { getManagedUserIds } from "../utils/subadminScope.js";
```

Replace lines 7-15:

```js
export const canActForUser = async (actor, targetUserId) => {
  if (String(targetUserId) === String(actor._id)) return true;
  if (actor.role === "admin") return true;
  if (actor.role === "manager") {
    const target = await User.findById(targetUserId);
    return !!target && String(target.reportingManager) === String(actor._id);
  }
  if (actor.role === "subadmin") {
    const managedIds = (await getManagedUserIds(actor)).map(String);
    return managedIds.includes(String(targetUserId));
  }
  return false;
};
```

- [ ] **Step 2: Append smoke assertions**

In `backend/scripts/smoke-subadmin.js`, insert before the final `console.log`:

```js
  // --- subadmin: can act for a managed user, not for an outsider -----------

  const iso = (offsetHours) => new Date(Date.now() + offsetHours * 3600 * 1000).toISOString();

  const timeBlockInScope = await axios.post(
    `${BASE}/timeblocks`,
    { title: "Subadmin-created block", start: iso(1), end: iso(2), category: "meeting", user: memberA.userId },
    subadmin.auth
  );
  assert.equal(timeBlockInScope.status, 201, "subadmin creates a time block for a managed user");

  const timeBlockOutOfScope = await axios.post(
    `${BASE}/timeblocks`,
    { title: "Should fail", start: iso(1), end: iso(2), category: "meeting", user: outsider.userId },
    { ...subadmin.auth, validateStatus: () => true }
  );
  assert.equal(timeBlockOutOfScope.status, 403, "subadmin cannot create a time block for an outsider");

  console.log("smoke-subadmin: all checks passed");
};

run().catch((error) => {
  console.error("smoke-subadmin failed:", error.response?.data?.message || error.message);
  process.exit(1);
});
```

- [ ] **Step 3: Run the smoke suite**

Run: `cd backend && npm run smoke`
Expected: `smoke-subadmin: all checks passed`, full chain exit 0. Also confirm `smoke-timeblocks.js` still passes unmodified.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/timeblockController.js backend/scripts/smoke-subadmin.js
git commit -m "feat: let a subadmin view/act on time blocks for their managed department's users"
```

---

### Task 9: Frontend — role option, managed-department field, and admin-parity UI gating

**Files:**
- Modify: `frontend/components/team/UserDialog.jsx`
- Modify: `frontend/app/(app)/team/page.js`
- Modify: `frontend/components/team/OrgStructure.jsx`
- Modify: `frontend/constants/nav.constants.js`

**Interfaces:**
- Consumes: backend's `role: "subadmin"` and `User.managedDepartment` (Tasks 1-2); `fetchDepartments()`/`fetchTeams()` from `frontend/services/orgService.js` (unchanged, already used by these files).

- [ ] **Step 1: Add the subadmin role option and managed-department field to UserDialog**

In `frontend/components/team/UserDialog.jsx`, replace line 21:

```js
  role: yup.string().oneOf(["admin", "manager", "sublead", "member"]).required(),
```

with:

```js
  role: yup.string().oneOf(["admin", "manager", "subadmin", "sublead", "member"]).required(),
  managedDepartment: yup.string().when("role", {
    is: "subadmin",
    then: (s) => s.required("Managed department is required for the subadmin role"),
    otherwise: (s) => s.strip(),
  }),
```

Replace line 46 (inside the `reset(...)` call in the `useEffect`):

```js
        role: user?.role || "member",
```

with:

```js
        role: user?.role || "member",
        managedDepartment: user?.managedDepartment?._id || "",
```

Add `watch` to the `useForm` destructure — replace lines 33-38:

```js
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: yupResolver(schema), context: { isEdit } });
```

with:

```js
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: yupResolver(schema), context: { isEdit } });

  const selectedRole = watch("role");
```

Replace the `mutation`'s payload construction (lines 59-65):

```js
      const payload = {
        ...values,
        department: values.department || null,
        team: values.team || null,
        reportingManager: values.reportingManager || null,
        isActive: values.isActive === "true",
      };
```

with:

```js
      const payload = {
        ...values,
        department: values.department || null,
        team: values.team || null,
        reportingManager: values.reportingManager || null,
        managedDepartment: values.role === "subadmin" ? values.managedDepartment || null : null,
        isActive: values.isActive === "true",
      };
```

Add a "Sub Admin" option to the role `<Select>` — replace lines 109-114:

```js
        <Select label="Role" error={errors.role?.message} {...register("role")}>
          <option value="member">Member</option>
          <option value="sublead">Sub Lead</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </Select>
```

with:

```js
        <Select label="Role" error={errors.role?.message} {...register("role")}>
          <option value="member">Member</option>
          <option value="sublead">Sub Lead</option>
          <option value="manager">Manager</option>
          <option value="subadmin">Sub Admin</option>
          <option value="admin">Admin</option>
        </Select>
```

Add the managed-department field, shown only when `selectedRole === "subadmin"` — insert right after the existing `Department` `<Select>` block (after line 123, the closing `</Select>` of the `Department` field):

```jsx
        {selectedRole === "subadmin" && (
          <Select label="Managed department" error={errors.managedDepartment?.message} {...register("managedDepartment")}>
            <option value="">Select department…</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </Select>
        )}
```

- [ ] **Step 2: Gate the Team page's admin-only UI to admin OR subadmin**

In `frontend/app/(app)/team/page.js`, replace line 18:

```js
  const isAdmin = me?.role === "admin";
```

with:

```js
  const isAdmin = me?.role === "admin";
  const canManageTeam = isAdmin || me?.role === "subadmin";
```

Replace every other use of `isAdmin` in this file (lines 28-29, 59, 104, 133, 149, 152, 169) with `canManageTeam` — for example line 28-29:

```js
    queryKey: isAdmin ? ["users"] : ["directory"],
    queryFn: isAdmin ? fetchUsers : fetchDirectory,
```

becomes:

```js
    queryKey: canManageTeam ? ["users"] : ["directory"],
    queryFn: canManageTeam ? fetchUsers : fetchDirectory,
```

and so on for lines 59, 104, 133, 149, 152, 169 (each `isAdmin` reference becomes `canManageTeam`) — the backend already enforces the real scoping (Tasks 2-3), this just shows a subadmin the same management UI an admin sees, with the same "People" / "Departments & Teams" tabs.

Also pass the current user down to `OrgStructure` so it can gate Department controls specifically — replace line 166:

```jsx
        <OrgStructure departments={departments} teams={teams} />
```

with:

```jsx
        <OrgStructure departments={departments} teams={teams} me={me} />
```

- [ ] **Step 3: Hide Department create/delete controls (but not Team controls) from a subadmin in OrgStructure**

In `frontend/components/team/OrgStructure.jsx`, replace line 15:

```js
export default function OrgStructure({ departments, teams }) {
```

with:

```js
export default function OrgStructure({ departments, teams, me }) {
  const canManageDepartments = me?.role === "admin";
```

Wrap the Departments `<section>` (lines 60-90) so it's only rendered when `canManageDepartments` is true — replace the opening tag on line 60:

```jsx
      <section className="rounded-card border border-border bg-surface p-6">
        <h3 className="text-base font-semibold tracking-tight">Departments</h3>
```

with:

```jsx
      {canManageDepartments && (
      <section className="rounded-card border border-border bg-surface p-6">
        <h3 className="text-base font-semibold tracking-tight">Departments</h3>
```

and close the added `{canManageDepartments && ( ... )}` wrapper right after that section's closing `</section>` on line 90 — replace:

```jsx
      </section>

      <section className="rounded-card border border-border bg-surface p-6">
        <h3 className="text-base font-semibold tracking-tight">Teams</h3>
```

with:

```jsx
      </section>
      )}

      <section className="rounded-card border border-border bg-surface p-6">
        <h3 className="text-base font-semibold tracking-tight">Teams</h3>
```

For a subadmin, restrict the Team-creation department dropdown to their own managed department (auto-selected, since they only have one) — replace lines 101-108:

```jsx
          <Select aria-label="Team department" value={teamDept} onChange={(e) => setTeamDept(e.target.value)}>
            <option value="">Department…</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </Select>
```

with:

```jsx
          <Select
            aria-label="Team department"
            value={canManageDepartments ? teamDept : me?.managedDepartment?._id || ""}
            disabled={!canManageDepartments}
            onChange={(e) => setTeamDept(e.target.value)}
          >
            <option value="">Department…</option>
            {(canManageDepartments ? departments : departments.filter((d) => d._id === me?.managedDepartment?._id)).map(
              (d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              )
            )}
          </Select>
```

And update the "Add" button's `mutationFn` call for team creation to use the locked department when the caller isn't an admin — replace line 39:

```js
    mutationFn: () => createTeam({ name: teamName, department: teamDept }),
```

with:

```js
    mutationFn: () => createTeam({ name: teamName, department: canManageDepartments ? teamDept : me?.managedDepartment?._id }),
```

- [ ] **Step 4: Extend nav role gates to include subadmin where an admin/manager gate already exists**

In `frontend/constants/nav.constants.js`, replace line 22:

```js
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "manager"] },
```

with:

```js
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "manager", "subadmin"] },
```

`Leaderboard settings` (line 24, `roles: ["admin"]`) stays admin-only — that's the points-config endpoint, which stayed `authorize("admin")`-only in Task 6 (only the leaderboard view itself, not its scoring config, was opened to subadmin).

- [ ] **Step 5: Lint and build**

Run: `cd frontend && npm run lint && npm run build`
Expected: both exit 0 (pre-existing, unrelated lint failures in `TaskDialog.jsx`/`TaskDrawer.jsx` are known and out of scope — confirm the four files touched in this task have zero lint errors).

- [ ] **Step 6: Manual verification in the browser**

No live backend+browser is available to an automated implementer in this environment — this step must be done by a human before merging. Once done:

Log in as the seed admin. Create a subadmin user assigned to a department with at least one team and one member. Log out, log in as that subadmin. Confirm: the Team page shows both tabs (People, Departments & Teams) exactly as it does for admin; the People list only shows users from the subadmin's department; creating a user only offers the subadmin's own teams (implicitly, since only their department's teams show as valid via the backend's 403 on mismatch — verify the form surfaces that error cleanly rather than a raw JSON blob); the Departments & Teams tab shows Teams (creatable, scoped to the one department) but hides the Departments panel entirely; Reports and Leaderboard nav items are visible and return department-scoped data; a Google-search-style attempt to view another department's project/user (by guessing an ID in the URL or API) is rejected.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/team/UserDialog.jsx "frontend/app/(app)/team/page.js" frontend/components/team/OrgStructure.jsx frontend/constants/nav.constants.js
git commit -m "feat: add subadmin role option, managed-department field, and admin-parity UI gating"
```
