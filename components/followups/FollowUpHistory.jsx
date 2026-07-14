"use client";

import Badge from "@/components/ui/Badge";

const FIELDS = {
  morning: [
    ["yesterdayCompleted", "Yesterday I completed"],
    ["todayPlan", "Today's plan"],
    ["blockers", "Current blockers"],
  ],
  evening: [
    ["completedWork", "Completed work"],
    ["remainingWork", "Remaining work"],
    ["tomorrowPlan", "Tomorrow's plan"],
    ["challenges", "Challenges faced"],
  ],
};

const fmtDate = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export default function FollowUpHistory({ followUps }) {
  const byDate = followUps.reduce((acc, f) => {
    (acc[f.date] ||= []).push(f);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));

  if (!dates.length) {
    return <p className="text-sm text-muted">No previous follow-ups yet.</p>;
  }

  return (
    <div className="space-y-4">
      {dates.map((date) => (
        <section key={date} className="rounded-card border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold">{fmtDate(date)}</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {byDate[date]
              .sort((a, b) => (a.type === "morning" ? -1 : 1))
              .map((f) => (
                <div key={f._id} className="rounded-input border border-border/60 bg-background/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium capitalize">{f.type}</p>
                    <Badge value={f.status} />
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {FIELDS[f.type].map(([name, label]) => {
                      const value = f[f.type]?.[name];
                      if (!value) return null;
                      return (
                        <div key={name}>
                          <p className="text-[11px] text-muted">{label}</p>
                          <p className="whitespace-pre-wrap text-xs">{value}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
