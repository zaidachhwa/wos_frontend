# Department Segregation

Date: 2026-07-30

## Problem

An audit (see Appendix) found that department boundaries are enforced inconsistently across the app. Some areas are correctly scoped (subadmin's user management, follow-ups' sublead team-scope, notifications, calendar, reports/dashboards). Several are not:

1. `GET /users/directory` has no scoping at all — any authenticated user, including a plain `member`, sees the entire org roster across every department.
2. `GET /leaderboard` with no `?team=` shows the whole org's ranked roster to anyone who isn't `subadmin`.
3. Departments/Teams listing (`orgController.js`) is similarly unscoped — any user can enumerate the org's full structure.
4. `manager`'s project/task visibility (`visibilityFilter` and everything that calls it) is unconditional/org-wide by explicit prior design decision (`2026-07-28-subadmin-role-design.md`), which this spec deliberately supersedes per the user's requirement that every role be segregated.
5. `createProject` has zero department validation on `manager`/`members`, for any role including `subadmin` — projects can freely span departments.

This spec makes department the enforced visibility boundary everywhere, for every role except `admin`.

## Scope

One unified spec — the fix is architecturally a single change (one shared scope-resolution utility, consistently wired into every controller that currently branches on role ad hoc) applied across several endpoints, not several independent features. Implementation is still sequenced as multiple tasks (core utility first, since everything else depends on it), matching this spec's own "what changes" ordering.

Explicitly out of scope, decided as part of this design, not left ambiguous:
- Reports, dashboards, AI workload/chat, notifications, calendar, follow-ups, activity feed — the audit confirmed these are already scoped correctly (by reporting-line or self-identity, a different and still-valid principle from department-scoping) and are untouched by this spec.
- `User.department`'s drift from `team.department` — no authorization code reads `User.department` today (everything resolves department via `team → Team.department`); it stays a display-only field, undisturbed. Documented here as a conscious decision, not a silent gap.
- Sublead's existing team-scope in follow-ups (`req.user.team`) — a separate, already-correct feature, untouched.

## Design decisions (confirmed with the user)

- **`manager` becomes department-scoped**, reusing the exact same `managedDepartment` concept `subadmin` already has — one department per manager, not an array. This is a deliberate reversal of the prior spec's explicit "manager sees everything, not a bug" decision.
- **Cross-department projects**: `admin` can still assemble one (org-wide role, unrestricted by design); a department-scoped `manager` cannot — every `manager`/`members` value in a project they create must belong to their own department.
- **Plain `member`/`sublead` default scope is their whole department** (every team within it), not just their own single team — the boundary that matters per the user's requirement is department, not team. This applies to directory and leaderboard-default; it does not change follow-ups' existing sublead-owns-their-team feature.
- **Migration**: auto-assign each existing manager's department by inference, flag ambiguous/pre-existing cross-department data for admin review rather than blocking or breaking it.

## Core scope-resolution helper

`backend/src/utils/subadminScope.js` is renamed `backend/src/utils/departmentScope.js` and gains one new, role-agnostic entry point that every other area calls instead of re-deriving role logic locally:

```js
// Existing, unchanged in shape:
export const getManagedTeamIds = async (departmentId) => {
  const teams = await Team.find({ department: departmentId }, "_id");
  return teams.map((t) => t._id);
};

export const getManagedUserIds = async (subadminUser) => {
  const teamIds = await getManagedTeamIds(subadminUser.managedDepartment);
  const users = await User.find({ team: { $in: teamIds }, role: { $nin: ["admin", "subadmin"] } }, "_id");
  return users.map((u) => u._id);
};

// New: resolves department scope for ANY role, not just subadmin.
// - admin: unrestricted (null)
// - manager, subadmin: their managedDepartment (via getManagedTeamIds/getManagedUserIds above)
// - sublead, member: their own team's department (Team.findById(user.team).department),
//   scoped to that whole department, not just their own team
export const resolveDepartmentScope = async (user) => {
  if (user.role === "admin") return null; // unrestricted
  if (["manager", "subadmin"].includes(user.role)) {
    const teamIds = await getManagedTeamIds(user.managedDepartment);
    const userIds = await getManagedUserIds(user);
    return { departmentId: user.managedDepartment, teamIds, userIds };
  }
  if (!user.team) return { departmentId: null, teamIds: [], userIds: [user._id] }; // no team assigned — sees only self
  const team = await Team.findById(user.team, "department");
  const teamIds = await getManagedTeamIds(team.department);
  const users = await User.find({ team: { $in: teamIds } }, "_id");
  return { departmentId: team.department, teamIds, userIds: users.map((u) => u._id) };
};
```

`resolveDepartmentScope` is the single place "what department can this user see" is computed. Every controller below calls it instead of branching on `role` itself, which is what fixes the manager inconsistency the audit found (unconditional on one screen, reports-scoped on another) — there's now exactly one answer per user, used everywhere.

## Data model

`backend/src/models/User.js`: no schema change — `managedDepartment` already exists generically (added for `subadmin` in the prior spec). This spec only widens *which roles* the backend/admin-UI allow it to be set on validated for (`manager` in addition to `subadmin`), required (non-null) for both.

## Endpoint changes

**`GET /users/directory`** (`userController.js`'s `listDirectory`, currently `User.find()` with zero filter and no `authorize()`): call `resolveDepartmentScope(req.user)`; `null` → unchanged (full roster); otherwise filter to `{ team: { $in: scope.teamIds } }`.

**`GET /leaderboard`** (`leaderboardController.js`'s `getLeaderboard`): the existing subadmin-only branch (roster defaults to managed teams, `?team=` validated against `managedTeamIds` else 403) generalizes to every non-admin role via `resolveDepartmentScope`. `manager`, `sublead`, `member` all get: no `?team=` → roster defaults to `scope.teamIds`; `?team=` given → must be inside `scope.teamIds` or 403. `admin` unchanged (whole org, `?team=` unrestricted).

**Departments/Teams listing** (`orgController.js`, currently unauthenticated-scope beyond login): `resolveDepartmentScope(req.user)` → `null` returns everything (admin); otherwise departments list is filtered to `[scope.departmentId]` and teams list to `{ _id: { $in: scope.teamIds } }`.

**`manager`'s project/task visibility** — `projectController.js`'s `visibilityFilter`, `canManage`, `canViewProject`: remove `manager` from the `["admin", "manager"].includes(user.role) → {}` branch. `manager` now goes through the same scoped branch `subadmin` already uses: the visibility `$or` (members/manager/module-or-task-reachability) is built against `resolveDepartmentScope(user).userIds` **plus the manager's own `_id`** — not the managed set alone, since a manager must still see a project they personally manage or are a member of even if `getManagedUserIds`'s admin/subadmin exclusion would otherwise omit edge cases, and a manager's own identity is never guaranteed to be inside their own managed-user set. `canViewProject`'s module/task existence-check fallback uses this same combined set, not bare `user._id`, so a project reachable via `visibilityFilter`'s module/task clause doesn't 403 when fetched directly by id (the two functions must agree on one scope, per the prior subadmin spec's same finding). `taskController.js`'s `listTasks`/`getTask` inherit this automatically since they call `visibilityFilter`/`canViewProject`.

**`createProject`** (`projectController.js`): after resolving the acting user's scope, if it's not `null` (i.e., not admin), validate that `manager` and every id in `members` are in `scope.userIds` (or equal the acting user's own `_id`) — 400 otherwise, with a message naming the first out-of-scope id. This closes the gap for `subadmin` too, who had no such check before.

## Migration

New one-time script (`backend/scripts/migrate-manager-departments.js`, matching this repo's existing `migrate-*.js` convention):

1. For each existing `manager` with no `managedDepartment`: gather the departments of every user among (a) all members of projects they manage, (b) their own team's department if they have one. Assign the mode (most frequent) department. If no signal exists at all (no projects managed, no team), leave `managedDepartment` unset and add them to the report below.
2. Separately, scan all existing `Project` documents: for each, resolve the department of the manager and every member (via `team.department`); if more than one distinct department appears, record it in a report file (`backend/scripts/reports/department-segregation-violations.json` or similar) — **not auto-fixed, not blocking** — these are grandfathered in under the new rule and exist for an admin to review/reassign at their own pace.
3. Script output prints a summary (managers auto-assigned, managers left unset, projects flagged) so it isn't silent.

## Frontend

- User create/edit form: the existing subadmin-only "Managed department" picker becomes available for `manager` too (same field, same component, gated on `role === "manager" || role === "subadmin"` instead of `role === "subadmin"`).
- Team-filter dropdowns already fetched via `fetchTeams()` (projects list, leaderboard) automatically narrow once the backend list endpoint is scoped — no separate frontend filtering logic needed.
- A small new admin-only page (or a section under the existing admin area) reads the migration's violations report and lists it, so the flagged cross-department data isn't invisible after the migration runs once.

## Testing / verification plan

Extend/add smoke scripts (assert-based, real HTTP + real Mongo, this repo's only test convention), adversarially — i.e., asserting a cross-department user is *actually* blocked, not just that an in-scope user works:

1. `resolveDepartmentScope` (new, exported): unit-shaped smoke coverage for each role branch (admin→null, manager/subadmin→managedDepartment-derived, sublead/member→own-team-derived, member-with-no-team→self-only) — likely folded into the endpoint tests below rather than tested standalone, per this repo's no-unit-framework convention.
2. Directory: a member in Department A does not see a member in Department B in `GET /users/directory`; does see a teammate from a sibling team in their own department.
3. Leaderboard: a manager's default (no `?team=`) roster excludes Department B entirely; `?team=<a-team-in-B>` 403s; `?team=<their-own-department's-team>` succeeds.
4. Departments/Teams listing: a sublead cannot see Department B in the list at all.
5. Project/task visibility: a manager in Department A cannot see a project whose manager/members are entirely in Department B (mirrors `smoke-subadmin.js`'s existing project-visibility assertions, but for `manager`).
6. `createProject`: a Department-A manager creating a project with a Department-B member gets 400; the same request from `admin` succeeds.
7. Migration script: run against a fixture with a manager who has projects (auto-assign works), a manager with no projects but a team (falls back to team's department), and a manager with neither (left unset, appears in the report); a fixture cross-department project appears in the violations report and is not deleted/modified.

## Out of scope (explicitly, decided here)

Reports, dashboards, AI workload/chat, notifications, calendar, follow-ups, activity feed (already correctly scoped by a different, valid principle — untouched). `User.department`'s drift from `team.department` (display-only, not authorization-relevant, left as-is). Sublead's team-scope in follow-ups (separate feature, untouched). Multiple departments per manager (single department only, per the confirmed decision). Auto-fixing pre-existing cross-department projects/tasks (flagged for admin review, not modified by the migration).

## Appendix: audit findings this spec is based on

Full audit (file:line citations) confirming the six leak points and the "already correct, untouched" areas listed above was performed as part of this design's research phase; the findings are summarized in the Problem section and inform every section above. Not reproduced in full here to keep this document focused on the design rather than the investigation.
