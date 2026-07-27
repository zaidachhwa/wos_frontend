# Project Create/Edit Assignee Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user search/filter the directory when picking a project's Members in the Create/Edit Project dialog, instead of scanning a plain checkbox list.

**Architecture:** `frontend/components/ui/MultiSelect.jsx` already implements exactly this — a searchable popover multi-select over any `{_id, name}`-shaped list — and is already used the same way for task assignees in `TaskDialog.jsx`. Swap `ProjectDialog.jsx`'s checkbox grid for `<MultiSelect>`; no new component.

**Tech Stack:** Existing `frontend/components/ui/MultiSelect.jsx`, no new dependency.

## Global Constraints

- No backend change — the `members` payload sent by `createProject`/`updateProject` is unchanged (still an array of user ids).
- No design doc for this one (trivial reuse of an existing, already-proven component) — this plan doc is the whole spec.

---

### Task 1: Swap the Members checkbox list for MultiSelect

**Files:**
- Modify: `frontend/components/projects/ProjectDialog.jsx`

- [ ] **Step 1: Import MultiSelect**

Add, after line 12 (`import { Input, Textarea, Select, Button } from "@/components/ui/Field";`):

```js
import MultiSelect from "@/components/ui/MultiSelect";
```

- [ ] **Step 2: Replace the checkbox block with MultiSelect**

Replace lines 123-143:

```jsx
      <div>
        <p className="text-sm font-medium">Members</p>
        <div className="mt-2 grid max-h-44 grid-cols-1 gap-1 overflow-y-auto rounded-input border border-border p-2 sm:grid-cols-2">
          {directory.map((d) => (
            <label
              key={d._id}
              className="flex cursor-pointer items-center gap-2 rounded-btn px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-background"
            >
              <input
                type="checkbox"
                checked={memberIds.includes(d._id)}
                onChange={() => toggleMember(d._id)}
                className="accent-primary"
              />
              <span className="truncate">{d.name}</span>
              <span className="ml-auto text-xs capitalize text-muted">{d.role}</span>
            </label>
          ))}
          {!directory.length && <p className="px-2 py-1.5 text-sm text-muted">No people yet.</p>}
        </div>
      </div>
```

with:

```jsx
      <MultiSelect
        label="Members"
        items={directory}
        value={memberIds}
        onChange={setMemberIds}
        placeholder="Search members…"
      />
```

- [ ] **Step 3: Remove the now-unused `toggleMember` helper**

Remove lines 72-73:

```js
  const toggleMember = (id) =>
    setMemberIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
```

`MultiSelect` manages toggling internally via its own `onChange`/`value` contract, so this helper has no remaining caller.

- [ ] **Step 4: Lint and build**

Run: `cd frontend && npm run lint && npm run build`
Expected: both exit 0 — in particular, lint must not flag `toggleMember` or `directory`'s role field as now-unused elsewhere (`directory` itself is still used by `managerOptions`, so no unused-var warning is expected there).

- [ ] **Step 5: Manual verification in the browser**

Run: `cd backend && npm run dev` and `cd frontend && npm run dev`.
Open Projects → Create project. Confirm the Members field is now a single button showing a placeholder/summary, opening a popover with a search box on click. Type a partial name and confirm the list filters. Select two or three people, confirm the button summarizes them (e.g. "Alice, Bob +1"), submit the form, and confirm the created project's members match what was selected (check via the project detail page or `GET /projects/:id`). Repeat for Edit project on an existing project with members already set — confirm they show pre-checked.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/projects/ProjectDialog.jsx
git commit -m "feat: searchable member picker in the project create/edit dialog"
```
