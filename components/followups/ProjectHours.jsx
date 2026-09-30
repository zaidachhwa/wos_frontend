// Time an employee logged per project in their evening follow-up
// (FollowUp.evening.projects), plus helpers to total it.

export const fmtMinutes = (mins) => {
  const m = Math.round(mins || 0);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest}m`;
  return rest ? `${h}h ${rest}m` : `${h}h`;
};

const minutesOf = (entry) => entry.totalMinutes ?? (entry.hours || 0) * 60 + (entry.minutes || 0);

export const projectEntries = (followUp) =>
  (followUp?.evening?.projects || []).map((p) => ({
    id: String(p.project?._id || p.project || ""),
    name: p.project?.name || "Deleted project",
    minutes: minutesOf(p),
  }));

export const totalMinutes = (followUp) => projectEntries(followUp).reduce((s, p) => s + p.minutes, 0);

// Inline one-liner for a list row: "Navy 3h 30m · WOS 2h".
export function ProjectHoursInline({ followUp }) {
  const entries = projectEntries(followUp);
  if (!entries.length) return <span className="text-xs text-muted">No project hours logged</span>;
  return (
    <span className="text-xs text-muted">
      <span className="font-medium text-primary">{fmtMinutes(totalMinutes(followUp))}</span>
      {" — "}
      {entries.map((p) => `${p.name} ${fmtMinutes(p.minutes)}`).join(" · ")}
    </span>
  );
}

// Full table for the follow-up detail dialog.
export function ProjectHoursTable({ followUp }) {
  const entries = projectEntries(followUp);
  return (
    <div>
      <p className="text-xs text-muted">Hours by project</p>
      {entries.length === 0 ? (
        <p className="mt-0.5">—</p>
      ) : (
        <table className="mt-1 w-full text-sm">
          <tbody>
            {entries.map((p, i) => (
              <tr key={`${p.id}-${i}`} className="border-b border-border/60">
                <td className="py-1.5">{p.name}</td>
                <td className="py-1.5 text-right tabular-nums">{fmtMinutes(p.minutes)}</td>
              </tr>
            ))}
            <tr>
              <td className="py-1.5 font-semibold">Total</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{fmtMinutes(totalMinutes(followUp))}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

// Day summary across every follow-up shown: hours per project, most first.
export function ProjectHoursSummary({ followUps }) {
  const byProject = new Map();
  let people = 0;
  for (const f of followUps) {
    const entries = projectEntries(f);
    if (entries.length) people += 1;
    for (const p of entries) {
      const cur = byProject.get(p.id) || { id: p.id, name: p.name, minutes: 0, people: new Set() };
      cur.minutes += p.minutes;
      cur.people.add(String(f.user?._id));
      byProject.set(p.id, cur);
    }
  }
  const rows = [...byProject.values()].sort((a, b) => b.minutes - a.minutes);
  if (!rows.length) return null;
  const total = rows.reduce((s, r) => s + r.minutes, 0);

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Hours by project</h3>
        <p className="text-xs text-muted">
          {fmtMinutes(total)} logged by {people} {people === 1 ? "person" : "people"}
        </p>
      </div>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-1.5 font-medium">Project</th>
            <th className="py-1.5 text-right font-medium">People</th>
            <th className="py-1.5 text-right font-medium">Hours</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border/60">
              <td className="py-1.5">{r.name}</td>
              <td className="py-1.5 text-right tabular-nums text-muted">{r.people.size}</td>
              <td className="py-1.5 text-right font-medium tabular-nums">{fmtMinutes(r.minutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
