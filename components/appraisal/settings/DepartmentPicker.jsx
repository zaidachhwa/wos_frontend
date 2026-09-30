"use client";

// "Applies to" control for a criterion: all departments, or a ticked set.
// value: [] = all departments; otherwise an array of department ids.
export default function DepartmentPicker({ scope, onScopeChange, value = [], onChange, departments, error }) {
  const toggle = (id, checked) => onChange(checked ? [...value, id] : value.filter((v) => v !== id));

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Applies to</legend>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={scope === "all"} onChange={() => onScopeChange("all")} />
          All departments
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={scope === "selected"} onChange={() => onScopeChange("selected")} />
          Selected departments only
        </label>
      </div>
      {scope === "selected" && (
        <div className="grid grid-cols-1 gap-2 rounded-btn border border-border bg-background p-3 sm:grid-cols-2">
          {departments.length === 0 && <p className="text-sm text-muted">No departments exist yet.</p>}
          {departments.map((d) => (
            <label key={d._id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={value.includes(d._id)} onChange={(e) => toggle(d._id, e.target.checked)} />
              {d.name}
            </label>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </fieldset>
  );
}
