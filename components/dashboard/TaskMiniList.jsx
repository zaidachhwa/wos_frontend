import Badge from "@/components/ui/Badge";

export default function TaskMiniList({ tasks, empty = "Nothing here.", showAssignee = false }) {
  if (!tasks?.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-1">
      {tasks.slice(0, 6).map((t) => (
        <li key={t._id} className="flex items-center gap-2 rounded-btn px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-background">
          <span className="min-w-0 flex-1 truncate">{t.title}</span>
          {showAssignee && t.assignee?.name && (
            <span className="shrink-0 text-xs text-muted">{t.assignee.name}</span>
          )}
          {t.deadline && (
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {new Date(t.deadline).toLocaleDateString()}
            </span>
          )}
          <Badge value={t.status} />
        </li>
      ))}
      {tasks.length > 6 && <li className="px-2 text-xs text-muted">+{tasks.length - 6} more</li>}
    </ul>
  );
}
