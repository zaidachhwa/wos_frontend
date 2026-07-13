"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Field";
import { fetchNotifications, markRead, markAllRead } from "@/services/notificationService";

const startOfDay = (offset = 0) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
};

const groupOf = (n) => {
  const created = new Date(n.createdAt);
  if (created >= startOfDay(0)) return "Today";
  if (created >= startOfDay(-1)) return "Yesterday";
  return "Older";
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["notifications"], queryFn: fetchNotifications });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const read = useMutation({ mutationFn: markRead, onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: markAllRead, onSuccess: invalidate });

  const notifications = data?.notifications || [];
  const groups = ["Today", "Yesterday", "Older"]
    .map((g) => [g, notifications.filter((n) => groupOf(n) === g)])
    .filter(([, list]) => list.length);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {data?.unreadCount ? `${data.unreadCount} unread` : "All caught up"}
        </p>
        {data?.unreadCount > 0 && (
          <Button variant="secondary" disabled={readAll.isPending} onClick={() => readAll.mutate()}>
            <CheckCheck size={15} /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-card" />
      ) : notifications.length ? (
        groups.map(([group, list]) => (
          <section key={group}>
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">{group}</h2>
            <div className="mt-2 divide-y divide-border/60 rounded-card border border-border bg-surface">
              {list.map((n) => (
                <Link
                  key={n._id}
                  href={n.link || "#"}
                  onClick={() => !n.read && read.mutate(n._id)}
                  className="flex items-start gap-3 px-4 py-3 transition-colors duration-150 first:rounded-t-card last:rounded-b-card hover:bg-background"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-border" : "bg-info"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.read ? "" : "font-medium"}`}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block truncate text-xs text-muted">{n.body}</span>}
                    <span className="mt-0.5 block text-xs text-muted">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))
      ) : (
        <EmptyState
          icon={Bell}
          heading="No notifications yet"
          description="Task assignments, comments and reminders will land here."
        />
      )}
    </div>
  );
}
