# Follow-Up Team Scope Fix (Sublead + Subadmin)

Date: 2026-07-29

## Problem

`GET /followups?scope=team` (`followUpController.js`'s `listFollowUps`) is meant to let a
team lead see their team's follow-ups, but it scopes non-admin callers with
`{ reportingManager: req.user._id }`. A user's `team` (membership) and
`reportingManager` fields are independent and nothing in the codebase keeps
them in sync — a member can be placed on a sublead's team with
`reportingManager` left unset. Result: a sublead's team view silently omits
any teammate whose `reportingManager` doesn't happen to point back at them,
which is the reported bug ("not showing all the follow ups of the member").

Separately, `subadmin` isn't in the role-gate for `scope=team` at all today —
a subadmin gets a 403 calling this endpoint, with no team/department-scoped
follow-up visibility whatsoever.

## Scope

Backend: `followUpController.js`'s `listFollowUps` (scope=team branch) and
`reviewFollowUp`. Frontend: `app/(app)/follow-ups/page.js`'s two role-gate
constants. No changes to `Team`/`User` models, no data migration (the fix is
in which fields drive the query, not in backfilling `reportingManager`).

**Explicitly unchanged:** `manager`'s scoping stays `reportingManager`-based,
exactly as today — a manager's direct reports can legitimately span multiple
teams, so team-membership matching doesn't fit that role. The shared
`reportScopeFilter` helper (`utils/subadminScope.js`, used by
`reportController.js` and `aiController.js` for reports/workload/chat) is not
touched — those features keep today's behavior for every role, including
sublead. This fix is scoped to the follow-ups feature only.

## Backend logic

### `listFollowUps`'s `scope=team` branch

Role-gate array gains `subadmin`:
```js
const TEAM_SCOPE_ROLES = ["admin", "manager", "subadmin", "sublead"];
```
(Renamed from `SUBLEAD_PLUS` since the set now covers more than "sublead and
above" — `taskController.js`'s own `SUBLEAD_PLUS` is a separate constant in a
separate file and is untouched.)

The single `reportFilter` ternary becomes a per-role branch:

- **admin** — unchanged: `{ isActive: true }`.
- **subadmin** — new: `{ _id: { $in: await getManagedUserIds(req.user) }, isActive: true }`,
  imported from `utils/subadminScope.js` (the same helper every other
  subadmin-scoped feature already uses — department-wide, admin/subadmin
  roles pre-excluded by the helper itself).
- **sublead** — changed from `reportingManager` to team match: if
  `req.user.team` is set, `{ team: req.user.team, isActive: true }`; if the
  sublead has no `team` assigned, skip the query entirely and return an empty
  `followUps` list (don't let a null `team` match every teamless user via an
  accidental `{team: null}` query). This is self-inclusive by construction —
  the sublead's own record shares their own `team` value, so they appear in
  their own team's list, consistent with how admin's own filter is also
  self-inclusive.
- **manager** — unchanged: `{ reportingManager: req.user._id, isActive: true }`.

### `reviewFollowUp`

Today: `if (req.user.role !== "admin" && !isOwnManager) return 403`, where
`isOwnManager` is `owner.reportingManager === req.user._id`. This means a
sublead who can now *see* a teammate's follow-up under the fixed scope above
still can't review it — a visible-but-403 dead-end control.

New authorization, replacing the single `isOwnManager` check with an
role-matched set of checks (only one needs to be true):
- `req.user.role === "admin"` → always allowed (unchanged).
- `isOwnManager` (existing `reportingManager` check) → unchanged, still
  covers manager's existing review path.
- **sublead**: `req.user.role === "sublead" && req.user.team && String(owner.team) === String(req.user.team)`.
- **subadmin**: `req.user.role === "subadmin" && (await getManagedUserIds(req.user)).some((id) => String(id) === String(owner._id))`.

If none of these hold, 403 as today.

## Frontend

`app/(app)/follow-ups/page.js`:
- `hasTeamView` (line 25): add `"subadmin"` — `["admin", "manager", "subadmin", "sublead"]`.
- `canReview` (line 26): add `"sublead"` and `"subadmin"` — `["admin", "manager", "subadmin", "sublead"]`.
  (Today `canReview` excludes sublead entirely, matching the old backend
  restriction; now that sublead can review team members' submissions, the
  Review button/comment box in `TeamFollowUps.jsx` needs to actually render
  for them — otherwise this becomes the same "backend allows it, UI still
  hides it" dead-end this session's earlier reviews have already caught and
  fixed elsewhere.)

No other frontend changes — `TeamFollowUps.jsx` already takes `canReview` as
a prop and needs no changes itself.

## Testing / verification plan

Extend `backend/scripts/smoke-followups.js` (existing assert-based,
no-mocks, real-HTTP style) with:

1. A sublead fixture user with `team` set but `reportingManager` left
   unset/pointing elsewhere, plus a teammate on the same `team` (also with no
   `reportingManager` link to the sublead). `GET /followups?scope=team` as
   the sublead returns that teammate — proves the team-match fix, not the
   old reportingManager path.
2. A sublead with `team: null` calling `scope=team` gets an empty list
   (`followUps: []`), not an error and not every teamless user in the system.
3. A subadmin fixture (reusing the existing `smoke-subadmin.js` department/
   team setup pattern) calling `GET /followups?scope=team` sees a follow-up
   from a user in their managed department; does not see one from a user
   outside it. Previously this call 403'd for subadmin — now asserts 200.
4. The sublead from (1) can successfully `PATCH /followups/:id/review` on
   the teammate's submitted follow-up (was 403 before this fix). The
   subadmin from (3) can review a managed user's submission; cannot review
   one outside their department (403).
5. Manager's existing `scope=team`/review behavior is unchanged — reuse (not
   replace) the existing manager fixture/assertions already in this file to
   confirm no regression.

## Out of scope

`reportController.js`, `aiController.js`, `dashboardController.js`'s
`managerLikeDashboard`, `taskController.js`, `timeblockController.js` — every
other consumer of `reportingManager`-based sublead/manager scoping in the
codebase. All identified during investigation as sharing the same
underlying `team`/`reportingManager` divergence, but explicitly not part of
this fix per user decision (sublead-only, follow-ups-only). No `Team` model
change (no `lead` field added). No backfill/migration of `reportingManager`
data.
