const fmtTime = (d) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function ScheduleList({ blocks }) {
  if (!blocks?.length) return <p className="text-sm text-muted">No time blocks scheduled today.</p>;
  return (
    <ul className="space-y-1">
      {blocks.map((b) => (
        <li key={b._id} className="flex items-center gap-3 rounded-btn px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-background">
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {fmtTime(b.start)}–{fmtTime(b.end)}
          </span>
          <span className="min-w-0 flex-1 truncate">{b.title}</span>
          <span className="shrink-0 text-xs capitalize text-muted">{b.category.replace("_", " ")}</span>
        </li>
      ))}
    </ul>
  );
}
