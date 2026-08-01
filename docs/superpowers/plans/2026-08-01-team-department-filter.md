# Team Department Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a department filter to the Team page's People tab, matching the existing role filter's shape exactly.

**Architecture:** Pure frontend change to `frontend/app/(app)/team/page.js` — one new piece of state, one new clause in the existing `filtered` `useMemo`, one new `<select>` reusing data already fetched on the page (`departments`).

**Tech Stack:** Next.js 16 (App Router, `"use client"`), `@tanstack/react-query` v5 (no new query — `departments` is already fetched by this page).

## Global Constraints

- No backend changes.
- No new dependencies.
- People tab only — no change to the "Departments & Teams" tab (`OrgStructure.jsx`).
- This repo has no test framework. Verification is `npm run lint` (zero new errors) plus a manual check in the dev server.

---

### Task 1: Add department filter to Team page People tab

**Files:**
- Modify: `frontend/app/(app)/team/page.js:25` (state), `:47-56` (filter memo), `:93-104` (toolbar `<select>`s)

**Interfaces:**
- Consumes: `departments` (already in scope at line 41: `const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: fetchDepartments })`), each item shaped `{ _id, name, ... }`. `users` items shaped `{ ..., department: { _id, name } | null, ... }` (already the case — `UserTable.jsx:36` already renders `u.department?.name`).
- Produces: nothing consumed by a later task (single-task plan).

- [ ] **Step 1: Add filter state**

In `frontend/app/(app)/team/page.js`, next to the existing `roleFilter` state:

```js
  const [roleFilter, setRoleFilter] = useState("");
```

add:

```js
  const [departmentFilter, setDepartmentFilter] = useState("");
```

- [ ] **Step 2: Extend the filtering logic**

Find the existing `filtered` `useMemo`:

```js
  const filtered = useMemo(() => {
    let list = users || [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) => u.name.toLowerCase().includes(q) || (u.designation || "").toLowerCase().includes(q)
      );
    }
    if (roleFilter) list = list.filter((u) => u.role === roleFilter);
    return list;
  }, [users, search, roleFilter]);
```

Replace it with:

```js
  const filtered = useMemo(() => {
    let list = users || [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) => u.name.toLowerCase().includes(q) || (u.designation || "").toLowerCase().includes(q)
      );
    }
    if (roleFilter) list = list.filter((u) => u.role === roleFilter);
    if (departmentFilter) list = list.filter((u) => u.department?._id === departmentFilter);
    return list;
  }, [users, search, roleFilter, departmentFilter]);
```

- [ ] **Step 3: Add the department `<select>` to the People tab toolbar**

Find the existing role filter `<select>` in the `tab === "people"` toolbar block:

```jsx
            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
            >
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="subadmin">Sub Admin</option>
              <option value="sublead">Sub Lead</option>
              <option value="member">Member</option>
            </select>
```

Add immediately after it:

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

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no new errors for `app/(app)/team/page.js`.

- [ ] **Step 5: Manual verification**

Run: `npm run dev` (if not already running), then in the browser at `/team`:
1. People tab: pick a department from the new dropdown → only users in that department remain.
2. Combine with search and/or role filter → filters compose (AND), matching the existing `useMemo` chain behavior.
3. Reset the department dropdown to "All departments" → full list returns.
4. Switch to "Departments & Teams" tab → confirm it's unchanged (no department filter added there).

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/team/page.js"
git commit -m "Add department filter to Team page People tab"
```
