import { History } from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";

const timeAgo = (date) => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function ActivityFeed({ activities = [], emptyText = "No activity yet." }) {
  if (!activities.length) {
    return <EmptyState icon={History} heading={emptyText} />;
  }
  return (
    <ul className="space-y-1">
      {activities.map((a) => (
        <li key={a._id} className="flex items-baseline gap-3 rounded-btn px-3 py-2 text-sm transition-colors duration-150 hover:bg-background">
          <span className="shrink-0 text-xs tabular-nums text-muted">{timeAgo(a.createdAt)}</span>
          <span>
            <span className="font-medium">{a.actor?.name || "Someone"}</span>{" "}
            <span className="text-muted">{a.action.replace(/_/g, " ")}</span>
            {a.meta?.title && <span className="text-muted"> — “{a.meta.title}”</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
