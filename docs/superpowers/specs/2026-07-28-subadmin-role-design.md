# Sub-Admin Role (Department-Scoped Admin)

Date: 2026-07-28

## Problem

WorkOS today has four roles (`admin`, `manager`, `sublead`, `member`), with a hard admin/non-admin split: `admin` sees and manages everything company-wide, with zero scoping. There's no way to give someone admin-equivalent management rights over just one department. This adds a fifth role, `subadmin`, that gets full management rights (user management, team structure, projects/tasks) restricted to one department and every team in it.

## Scope

One unified spec covering the whole feature — implementation is sequenced (core scoping primitive first, since every other area depends on it) but nothing is deliberately deferred to a later spec. Explicitly excluded (stays admin-only, no exceptions): creating a new Department, renaming/deleting a Department, editing or deactivating an `admin` or `subadmin` account, creating a user with role `admin` or `subadmin`.

## Data model

- `backend/src/constants/roles.constants.js` — add `"subadmin"` to `ROLES`.
- `backend/src/models/User.js` — add `managedDepartment: { type: ObjectId, ref: "Department", default: null }`. Required (non-null) when `role === "subadmin"`, validated at the controller level (not a Mongoose-level conditional required, matching how other role-dependent fields in this codebase are validated in controllers rather than schema hooks).
- No `managedTeams` field — a sub-admin's teams are always *every* team currently in `managedDepartment`, resolved dynamically. No schema change to `Team`/`Department`.

## Core scope-resolution helper

One shared function, `getManagedUserIds(subadminUser)`, added to a new small module (e.g. `backend/src/utils/subadminScope.js`):

```js
export const getManagedTeamIds = async (departmentId) => {
  const teams = await Team.find({ department: departmentId }, "_id");
  return teams.map((t) => t._id);
};

export const getManagedUserIds = async (subadminUser) => {
  const teamIds = await getManagedTeamIds(subadminUser.managedDepartment);
  const users = await User.find({ team: { $in: teamIds } }, "_id");
  return users.map((u) => u._id);
};
```

Every other area of this spec calls this helper rather than re-deriving the department→team→user chain independently — this is the single place the scoping logic lives, and the single place it gets tested.

## User management

`backend/src/routes/userRoutes.js` / `userController.js`: `authorize("admin")` becomes `authorize("admin", "subadmin")` on create/list/update/deactivate routes. Inside each controller action, branch on `req.user.role`:

- **List**: admin → unchanged (`User.find({isActive:true})`). Subadmin → `User.find({isActive:true, team: {$in: managedTeamIds}, role: {$nin: ["admin","subadmin"]}})` — admins/subadmins are invisible to a subadmin's user list entirely, not just protected from edits.
- **Create**: subadmin may only set `team` to one of their managed teams (`department` is then set to match that team's department, keeping the existing `User.team`/`User.department` dual-field convention in sync — same as admin-created users today). Requested `role` must not be `admin`/`subadmin`, else 403.
- **Update/deactivate**: subadmin may only act on a target user whose `_id` is in `getManagedUserIds(req.user)`. If changing `team`, the new team must also be one of the subadmin's managed teams. If the target's current or requested role is `admin`/`subadmin`, 403.

## Team management

`backend/src/routes/orgRoutes.js` / relevant org controller: Team create/update/delete gets `authorize("admin", "subadmin")`. Scope check: create → the `department` on the new team must equal `req.user.managedDepartment`. Update/delete → the existing team's `department` must equal `req.user.managedDepartment`. Department create/update/delete stays `authorize("admin")` only, unchanged.

## Projects / Tasks / Modules

`projectController.js`'s `visibilityFilter(user)` gets a third branch: admin/manager → `{}` (unchanged). Non-admin/manager branch currently builds an `$or` of `members`/`manager`/module-or-task-reachability for `user._id` alone — for a subadmin, build the identical `$or` shape but against `getManagedUserIds(user)` **plus the subadmin's own `_id`** (not the managed set alone — a subadmin must see projects they themselves manage or are a member of, same as any other role can see its own work; `getManagedUserIds`'s admin/subadmin exclusion is a role-cap concern for *managing other people*, a different thing from *this user's own visibility*, so the two don't share an exclusion rule). `canViewProject(user, project)`'s module/task fallback checks (`ProjectModule.exists`/`Task.exists` on `assignees`) must use this same combined set, not bare `user._id` — otherwise a project reachable via `visibilityFilter`'s module/task clause 403s when fetched directly by id, since the two functions would be scoping differently for the same subadmin. Task and module visibility, which already derive from project visibility or assignee identity elsewhere in the codebase, get the same substitution wherever they currently check "is this user the assignee/self."

Create routes (`projectRoutes.js` etc.) that are currently `authorize("admin","manager")` also get `subadmin` added. Note this is *not* the same guarantee a manager has: a manager's `visibilityFilter` branch is `{}` (sees everything unconditionally), so a manager-created project is always visible to them regardless of who's on it. A subadmin's branch is genuinely filtered, so a subadmin-created project is only visible to them afterward if it includes at least one manager/member/assignee from their managed set (or themself, per the combined set above) — an accepted, spec'd tradeoff of real scoping, not an oversight to "fix" to match manager's unconditional visibility.

## Dashboard, Reports, Leaderboard, AI (workload + chat)

All four already branch on `role === "admin"` (company-wide) vs. `reportingManager"/manager-scoped` (per the codebase's existing `dashboardController.js`, `reportController.js:39-139`, `leaderboardController.js`, `aiController.js`'s `workloadAnalysis`/`chat`). Each gets one more branch: `role === "subadmin"` → use `getManagedUserIds(req.user)` as the roster/audience, in place of "all non-admin users" or "my direct reports." Route-level `authorize(...)` allowlists on these four areas gain `"subadmin"`.

Leaderboard specifically: its existing `?team=` query param still works as a sub-filter within the subadmin's already-restricted roster (a subadmin can still narrow to one of their own teams; they can't use `?team=` to see a team outside their department, since the base roster query already excludes it).

## Calendar (viewing/acting for another user)

`canActForUser(actor, targetUserId)` (`timeblockController.js`, reused by `calendarController.js`) gets a third branch: `subadmin` → true if `targetUserId` is in `getManagedUserIds(actor)`.

## Notifications

No change. There is no admin-authored broadcast/announcement feature in the app today (`notificationController.js` is entirely system-generated and self-scoped to `req.user._id` regardless of role) — nothing exists here to scope.

## Frontend

- `frontend/constants/roles.constants.js` (or wherever role options are enumerated for the user-create/edit form and any role-based UI branching) — add `"subadmin"`.
- User create/edit form (`components/users/...` — wherever the admin's user-management UI lives): when creating a user with role `subadmin`, show a required Department picker (`managedDepartment`) sourced from `fetchDepartments()`. Existing team pickers already filter to admin's full list — for a logged-in subadmin viewing this same form, the directory/team/department data the form receives should already come pre-scoped from the backend list endpoints (no separate client-side filtering needed, since the backend now returns only in-scope data to a subadmin caller).
- Nav/route guards: wherever `role === "admin"` currently gates a nav item or page (org management, user management, reports, leaderboard, dashboard, AI chat), add `subadmin` to the same checks — the backend enforces the actual scoping regardless, but the UI should show these entries to a subadmin the same way it shows them to an admin.

## Testing / verification plan

New `backend/scripts/smoke-subadmin.js`, added to the `smoke` npm script chain, following the existing assert-based integration-test style (real HTTP calls, real Mongo, no mocks). Minimum coverage:

1. A subadmin can list/create/update/deactivate a user whose team is in their department; cannot act on a user in a different department (403/404 per existing convention).
2. A subadmin cannot create a user with role `admin` or `subadmin`; cannot edit/deactivate an existing `admin` or `subadmin` account even if that account's team happens to sit in their department.
3. A subadmin can create/rename/delete a Team within their department; cannot do so for a team in a different department.
4. A subadmin cannot create/rename/delete a Department.
5. Projects/tasks: a subadmin sees a project whose manager/member is in their managed set, and does NOT see one that isn't — mirroring the existing `smoke-projects.js`/`smoke-tasks-extra.js` visibility-check style.
6. Dashboard/reports/leaderboard/AI workload+chat: a subadmin's roster/results are limited to their managed-user-set (spot-check one representative assertion per area, not exhaustive re-tests of each area's full existing behavior).
7. Calendar: a subadmin can view/create a time block for a managed user; cannot for an unmanaged one.
8. A `managedDepartment` is required when creating a user with role `subadmin` (validation error otherwise).

## Out of scope (explicitly, no exceptions)

Creating a new Department; renaming/deleting a Department; a subadmin editing or deactivating an `admin` or `subadmin` account (including their own role); a subadmin creating another `admin`/`subadmin`; any notification broadcast feature (doesn't exist, not being added here); any change to the existing `manager`/`sublead`/`member` roles' behavior.
