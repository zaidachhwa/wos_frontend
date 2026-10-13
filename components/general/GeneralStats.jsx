import { STATUS_HELP } from "@/components/general/generalTaskUtils";

const TILES = [
  { key: "total", label: "Total", tone: "" },
  { key: "completed", label: "Completed", tone: "text-success" },
  { key: "delayed", label: "Delayed", tone: "text-warning" },
  { key: "overdue", label: "Overdue", tone: "text-danger" },
  { key: "pending", label: "Pending", tone: "text-info" },
];

// Clickable stat tiles; clicking one filters the list to that status.
export default function GeneralStats({ stats, active, onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {TILES.map((t) => {
        const selected = (active || "total") === t.key;
        return (
          <button
            key={t.key}
            type="button"
            title={STATUS_HELP[t.key] || "All tasks"}
            onClick={() => onSelect(t.key === "total" ? "" : t.key)}
            className={`rounded-card border bg-surface p-4 text-left transition-colors duration-150 hover:bg-background ${
              selected ? "border-primary" : "border-border"
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{t.label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${t.tone}`}>{stats?.[t.key] ?? 0}</p>
          </button>
        );
      })}
    </div>
  );
}
