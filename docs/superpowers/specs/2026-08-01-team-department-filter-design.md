# Team page — department filter (sub-project 1 of 4)

## Context

This is the first of four independent sub-projects adding a department
filter across the app (Team page, Projects list, Tasks list, Reports page).
Only the Team page is in scope here — it's the smallest, is entirely
frontend, and establishes the department-`<select>` pattern the other three
sub-projects can follow. Projects, Tasks, and Reports don't store department
directly and need backend query-param support; they get their own
spec/plan/build cycles later.

## Problem

`/team`'s People tab already has a search box and a role filter
(`frontend/app/(app)/team/page.js`), and each user row already displays
department (`components/team/UserTable.jsx:19,36`, via
`u.department?.name`). The department data is already fetched
(`fetchDepartments`, `frontend/services/orgService.js:27`) but currently only
used by the "Departments & Teams" tab (`OrgStructure.jsx`) — there's no way
to filter the People list by department.

## Goal

Add a department filter to the People tab, matching the existing role
filter's UX and implementation shape exactly.

## Design

### State

In `frontend/app/(app)/team/page.js`, add alongside the existing
`roleFilter` state (line 25):

```js
const [departmentFilter, setDepartmentFilter] = useState("");
```

### Filtering logic

In the `filtered` `useMemo` (currently filters by `search` and `roleFilter`),
add a third filter, same shape as the existing `roleFilter` check:

```js
if (departmentFilter) list = list.filter((u) => u.department?._id === departmentFilter);
```

Users with no department (`u.department` is `null`) simply won't match when
a specific department is selected — no "Unassigned" bucket, consistent with
how the existing role filter behaves (a user with no role never happens, but
the pattern here is "exact match or excluded," not "show a null-value
bucket").

### UI

Add a `<select>` next to the existing role filter `<select>` (People tab
toolbar, `frontend/app/(app)/team/page.js` ~line 93), using the already-fetched
`departments` array (`const { data: departments = [] } = useQuery(...)`,
already present at line 41):

```jsx
<select
  aria-label="Filter by department"
  value={departmentFilter}
  onChange={(e) => setDepartmentFilter(e.target.value)}
  className="rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
>
  <option value="">All departments</option>
  {departments.map((d) => (
    <option key={d._id} value={d._id}>
      {d.name}
    </option>
  ))}
</select>
```

Same `className` as the existing role filter `<select>` for visual
consistency.

### Scope boundary

- **People tab only.** The "Departments & Teams" tab (`OrgStructure.jsx`) is
  already organized by department; no filter added there.
- No changes to `fetchUsers`/`fetchDirectory`/`fetchDepartments` — all data
  needed is already fetched by the page.
- No backend changes.

## Out of scope

- Projects list, Tasks list, Reports page department filters — separate
  sub-projects, tracked to follow this one.
- Any "Unassigned" bucket or multi-select department filtering.

## Testing

No test framework in this repo. Verification: `npm run lint` (zero new
errors) plus manual check in the dev server — select a department, confirm
only users in that department show; combine with the existing search and
role filters to confirm they compose (AND, not OR, matching the existing
`useMemo` chain); clear the department filter, confirm the full list returns.
