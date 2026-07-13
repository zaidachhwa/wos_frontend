"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { fetchNotifications, markRead } from "@/services/notificationService";

const timeAgo = (date) => {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
  });
  const unread = data?.unreadCount || 0;

  const read = useMutation({
    mutationFn: markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative rounded-btn p-2 text-muted transition-colors duration-150 hover:bg-background hover:text-primary"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-dropdown border border-border bg-surface py-2 shadow-md animate-[fadeIn_150ms_ease-out]">
            <p className="px-4 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted">
              Notifications
            </p>
            {(data?.notifications || []).slice(0, 5).map((n) => (
              <Link
                key={n._id}
                href={n.link || "/notifications"}
                onClick={() => {
                  if (!n.read) read.mutate(n._id);
                  setOpen(false);
                }}
                className="flex items-start gap-2 px-4 py-2 transition-colors duration-150 hover:bg-background"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-border" : "bg-info"}`}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{n.title}</span>
                  <span className="block text-xs text-muted">{timeAgo(n.createdAt)} ago</span>
                </span>
              </Link>
            ))}
            {!data?.notifications?.length && (
              <p className="px-4 py-3 text-sm text-muted">Nothing yet.</p>
            )}
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="mt-1 block border-t border-border px-4 pb-1 pt-2 text-sm font-medium text-info transition-colors duration-150 hover:opacity-80"
            >
              View all
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
