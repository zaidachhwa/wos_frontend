# Follow-Up Team Scope Fix (Sublead + Subadmin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `GET /followups?scope=team` and `PATCH /followups/:id/review` so a sublead sees/can-review every member of their own `Team`, not just users whose `reportingManager` happens to point at them; and add the same capability for `subadmin`, scoped to their managed department (previously 403 for subadmin — not gated in at all).

**Architecture:** Backend-only logic change in `followUpController.js` (two functions), plus two one-line frontend role-gate widenings. No schema/model changes, no data migration — the fix changes which fields a query reads, not what data exists.

**Tech Stack:** Express 5 + Mongoose (backend, ESM, `node --env-file`), assert-based smoke scripts (no mocks, real HTTP + live Mongo) via `npm run smoke`. Next.js 16 + JS (frontend), no test framework — lint + build only.

## Global Constraints

- Manager's scoping (`{ reportingManager: req.user._id, isActive: true }`) stays exactly as-is in both `listFollowUps` and `reviewFollowUp` — do not touch it.
- The shared `reportScopeFilter` helper in `backend/src/utils/subadminScope.js` (used by `reportController.js` and `aiController.js`) is **not** touched by this plan — only `followUpController.js` changes.
- `getManagedUserIds` (already exported from `backend/src/utils/subadminScope.js`) is reused as-is, not modified.
- A sublead with no `team` assigned must get a `200` with an empty `followUps: []` list from `scope=team` — never an error, and never a query that accidentally matches every teamless user (e.g. never construct `{ team: null }` and send it to Mongo).

---

### Task 1: Backend — team-match scoping for sublead, add subadmin, extend review rights

**Files:**
- Modify: `backend/src/controllers/followUpController.js`
- Modify: `backend/scripts/smoke-followups.js`

**Interfaces:**
- Consumes: `getManagedUserIds` from `backend/src/utils/subadminScope.js` (signature: `async (subadminUser) => ObjectId[]`, already exists, already used by `reportController.js`/`aiController.js`).

- [ ] **Step 1: Import `getManagedUserIds` and rename the role-gate constant**

At the top of `backend/src/controllers/followUpController.js`, add the import (after the existing `gemini.js` import on line 7):

```js
import { getManagedUserIds } from "../utils/subadminScope.js";
```

Replace line 9:

```js
const SUBLEAD_PLUS = ["admin", "manager", "sublead"];
```

with:

```js
const TEAM_SCOPE_ROLES = ["admin", "manager", "subadmin", "sublead"];
```

- [ ] **Step 2: Rewrite `listFollowUps`'s `scope=team` branch**

Replace this block (currently lines 67-79):

```js
    if (scope === "team") {
      if (!SUBLEAD_PLUS.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      if (!date || !type) {
        return res
          .status(400)
          .json({ success: false, message: "date and type are required for scope=team" });
      }
      const reportFilter =
        req.user.role === "admin"
          ? { isActive: true }
          : { reportingManager: req.user._id, isActive: true };
      const reports = await User.find(reportFilter).select("name role");
```

with:

```js
    if (scope === "team") {
      if (!TEAM_SCOPE_ROLES.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      if (!date || !type) {
        return res
          .status(400)
          .json({ success: false, message: "date and type are required for scope=team" });
      }
      let reportFilter;
      if (req.user.role === "admin") {
        reportFilter = { isActive: true };
      } else if (req.user.role === "subadmin") {
        const managedIds = await getManagedUserIds(req.user);
        reportFilter = { _id: { $in: managedIds }, isActive: true };
      } else if (req.user.role === "sublead") {
        if (!req.user.team) {
          return res.json({ success: true, message: "Follow-ups fetched", data: { followUps: [] } });
        }
        reportFilter = { team: req.user.team, isActive: true };
      } else {
        reportFilter = { reportingManager: req.user._id, isActive: true };
      }
      const reports = await User.find(reportFilter).select("name role");
```

The rest of the `scope === "team"` block (building `existing`, `byUser`, `followUps`, and the `return res.json(...)`) is unchanged — leave it exactly as-is below this replaced section.

- [ ] **Step 3: Extend `reviewFollowUp`'s authorization check**

Replace this block (currently lines 128-132):

```js
    const owner = await User.findById(followUp.user);
    const isOwnManager = owner && String(owner.reportingManager) === String(req.user._id);
    if (req.user.role !== "admin" && !isOwnManager) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
```

with:

```js
    const owner = await User.findById(followUp.user);
    const isOwnManager = owner && String(owner.reportingManager) === String(req.user._id);
    const isSubleadTeammate =
      req.user.role === "sublead" &&
      req.user.team &&
      owner &&
      String(owner.team) === String(req.user.team);
    const isSubadminManaged =
      req.user.role === "subadmin" &&
      owner &&
      (await getManagedUserIds(req.user)).some((id) => String(id) === String(owner._id));
    if (
      req.user.role !== "admin" &&
      !isOwnManager &&
      !isSubleadTeammate &&
      !isSubadminManaged
    ) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
```

- [ ] **Step 4: Add smoke coverage**

In `backend/scripts/smoke-followups.js`, insert the following new block right after line 207 (`assert.ok(!text.includes("Smoke member:"), "no more 'name: task' prefixing");`) and before line 209 (`console.log("smoke-followups: all checks passed");`):

```js
  // --- sublead team scope: team-membership match, not reportingManager ------

  const dept = await axios.post(`${BASE}/departments`, { name: `Followups Smoke Dept ${Date.now()}` }, adminAuth);
  const deptId = dept.data.data.department._id;
  const otherDept = await axios.post(
    `${BASE}/departments`,
    { name: `Followups Smoke Other Dept ${Date.now()}` },
    adminAuth
  );
  const otherDeptId = otherDept.data.data.department._id;

  const team = await axios.post(
    `${BASE}/teams`,
    { name: `Followups Smoke Team ${Date.now()}`, department: deptId },
    adminAuth
  );
  const teamId = team.data.data.team._id;
  const otherTeam = await axios.post(
    `${BASE}/teams`,
    { name: `Followups Smoke Other Team ${Date.now()}`, department: otherDeptId },
    adminAuth
  );
  const otherTeamId = otherTeam.data.data.team._id;

  const sublead = await createUser(adminAuth, "sublead", { team: teamId, department: deptId });
  // No reportingManager set on teammate/deptMember2 — proves the fix reads team
  // membership, not reportingManager.
  const teammate = await createUser(adminAuth, "member", { team: teamId, department: deptId });
  const deptMember2 = await createUser(adminAuth, "member", { team: teamId, department: deptId });
  const outsiderMember = await createUser(adminAuth, "member", { team: otherTeamId, department: otherDeptId });
  const subadmin = await createUser(adminAuth, "subadmin", { managedDepartment: deptId });

  const teammateFollowUp = await axios.post(
    `${BASE}/followups`,
    { date: today, type: "morning", data: { todayPlan: "Sublead scope check" }, submit: true },
    teammate.auth
  );
  assert.equal(teammateFollowUp.status, 200, "teammate submits a morning follow-up");
  const teammateFollowUpId = teammateFollowUp.data.data.followUp._id;

  const deptMember2FollowUp = await axios.post(
    `${BASE}/followups`,
    { date: today, type: "morning", data: { todayPlan: "Subadmin scope check" }, submit: true },
    deptMember2.auth
  );
  assert.equal(deptMember2FollowUp.status, 200, "second in-department member submits a morning follow-up");
  const deptMember2FollowUpId = deptMember2FollowUp.data.data.followUp._id;

  const outsiderFollowUp = await axios.post(
    `${BASE}/followups`,
    { date: today, type: "morning", data: { todayPlan: "Outsider check" }, submit: true },
    outsiderMember.auth
  );
  assert.equal(outsiderFollowUp.status, 200, "outsider submits a morning follow-up");
  const outsiderFollowUpId = outsiderFollowUp.data.data.followUp._id;

  const subleadTeamList = await axios.get(
    `${BASE}/followups?date=${today}&type=morning&scope=team`,
    sublead.auth
  );
  assert.equal(subleadTeamList.status, 200, "sublead lists team scope");
  const subleadRows = subleadTeamList.data.data.followUps;
  const teammateRow = subleadRows.find((f) => f.user._id === teammate.userId);
  assert.ok(teammateRow, "sublead sees teammate's submission via team match, despite no reportingManager link");
  assert.equal(teammateRow.status, "submitted", "teammate row shows submitted");
  assert.ok(
    !subleadRows.some((f) => f.user._id === outsiderMember.userId),
    "sublead's team list excludes a member on a different team"
  );

  const subleadNoTeam = await createUser(adminAuth, "sublead");
  const subleadNoTeamList = await axios.get(
    `${BASE}/followups?date=${today}&type=morning&scope=team`,
    subleadNoTeam.auth
  );
  assert.equal(subleadNoTeamList.status, 200, "sublead with no team assigned still gets 200, not an error");
  assert.deepEqual(
    subleadNoTeamList.data.data.followUps,
    [],
    "sublead with no team sees an empty list, not every teamless user"
  );

  // --- subadmin team scope: department-wide via getManagedUserIds -----------

  const subadminTeamList = await axios.get(
    `${BASE}/followups?date=${today}&type=morning&scope=team`,
    subadmin.auth
  );
  assert.equal(
    subadminTeamList.status,
    200,
    "subadmin can list team scope (previously 403, role wasn't gated in at all)"
  );
  const subadminRows = subadminTeamList.data.data.followUps;
  assert.ok(
    subadminRows.some((f) => f.user._id === deptMember2.userId),
    "subadmin sees a user in their managed department"
  );
  assert.ok(
    !subadminRows.some((f) => f.user._id === outsiderMember.userId),
    "subadmin's list excludes a user outside their managed department"
  );

  // --- review rights extended to match the new viewing scope -----------------

  const subleadReviews = await axios.patch(
    `${BASE}/followups/${teammateFollowUpId}/review`,
    { managerComment: "Sublead review" },
    sublead.auth
  );
  assert.equal(subleadReviews.status, 200, "sublead can review a teammate's submission via team match");
  assert.equal(subleadReviews.data.data.followUp.status, "reviewed", "status is reviewed");

  const subleadReviewsOutsiderForbidden = await axios.patch(
    `${BASE}/followups/${outsiderFollowUpId}/review`,
    { managerComment: "Not my team" },
    { ...sublead.auth, validateStatus: () => true }
  );
  assert.equal(subleadReviewsOutsiderForbidden.status, 403, "sublead cannot review a follow-up outside their team");

  const subadminReviews = await axios.patch(
    `${BASE}/followups/${deptMember2FollowUpId}/review`,
    { managerComment: "Subadmin review" },
    subadmin.auth
  );
  assert.equal(subadminReviews.status, 200, "subadmin can review a managed user's submission");
  assert.equal(subadminReviews.data.data.followUp.status, "reviewed", "status is reviewed");

  const subadminReviewsOutsiderForbidden = await axios.patch(
    `${BASE}/followups/${outsiderFollowUpId}/review`,
    { managerComment: "Not my department" },
    { ...subadmin.auth, validateStatus: () => true }
  );
  assert.equal(
    subadminReviewsOutsiderForbidden.status,
    403,
    "subadmin cannot review a follow-up outside their managed department"
  );
```

- [ ] **Step 5: Run the smoke suite**

Start the backend (`cd backend && npm run dev`, in a separate process/terminal from the one running the smoke script), then run:

```bash
cd backend && node --env-file=.env scripts/smoke-followups.js
```

Expected: `smoke-followups: all checks passed`. (This script can be intermittent for an unrelated, pre-existing reason — a real `GEMINI_API_KEY` configured in this dev environment causes the EOD work-log's AI-paraphrasing branch to occasionally reword text nondeterministically, breaking the `assert.match` checks in the existing EOD work-log section above your new code, lines ~200-207. If a run fails only on one of those pre-existing work-log-text assertions, re-run once or twice to confirm — that failure mode is known and unrelated to this task. Do not treat it as this task's bug, but do treat any failure in the new code you just added as a real failure to fix.)

Also run the full existing chain once to confirm no regression elsewhere:

```bash
cd backend && node --env-file=.env scripts/smoke-subadmin.js
```

(This exercises the untouched `getManagedUserIds` helper from a different angle — should be unaffected, but confirms nothing else broke.)

- [ ] **Step 6: Commit**

```bash
git add src/controllers/followUpController.js scripts/smoke-followups.js
git commit -m "feat: sublead sees/reviews their team's follow-ups by team membership, add subadmin department-wide scope"
```

---

### Task 2: Frontend — widen role gates for team view and review rights

**Files:**
- Modify: `frontend/app/(app)/follow-ups/page.js`

**Interfaces:**
- Consumes: nothing new — `me.role` from the existing `useAuthStore` read on line 24.

- [ ] **Step 1: Widen both role-gate constants**

Replace lines 25-26:

```js
  const hasTeamView = ["admin", "manager", "sublead"].includes(me?.role);
  const canReview = ["admin", "manager"].includes(me?.role);
```

with:

```js
  const hasTeamView = ["admin", "manager", "subadmin", "sublead"].includes(me?.role);
  const canReview = ["admin", "manager", "subadmin", "sublead"].includes(me?.role);
```

(`canReview` previously excluded `sublead` entirely, matching the old backend restriction where only admin/exact-reportingManager could review. Now that Task 1 lets a sublead review their team's submissions and a subadmin review their managed department's submissions, this flag must include both roles too — otherwise the Review button/comment box in `TeamFollowUps.jsx` stays hidden even though the backend would accept the request, the same "visible feature, hidden control" gap this codebase's earlier reviews have repeatedly caught.)

- [ ] **Step 2: Lint and build**

```bash
cd frontend && npm run lint && npm run build
```

Expected: both exit 0. Confirm `app/(app)/follow-ups/page.js` has zero NEW errors versus before this change.

- [ ] **Step 3: Manual verification in the browser**

Run `cd backend && npm run dev` and `cd frontend && npm run dev`. Log in as a sublead whose `team` matches at least one other user's `team` (not necessarily their `reportingManager`): confirm the Team tab appears, lists that teammate, and the Review button works on a submitted entry. Log in as a subadmin: confirm the same for a user in their managed department, and confirm a user outside their department does not appear.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/follow-ups/page.js"
git commit -m "feat: subadmin gets the follow-ups Team tab, sublead+subadmin get review rights"
```
