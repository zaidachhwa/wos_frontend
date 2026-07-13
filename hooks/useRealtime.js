"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/store/authStore";

// Live invalidation: the server pushes coarse events, TanStack refetches.
// The 30s polling on notifications stays as a fallback for dropped sockets.
export default function useRealtime() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    const socket = io(process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, ""), {
      withCredentials: true,
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
    });
    const invalidate = (...keys) =>
      keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    socket.on("notification", () => invalidate("notifications", "dashboard"));
    socket.on("tasks_changed", () => invalidate("tasks", "task", "dashboard", "project", "projects"));
    return () => socket.disconnect();
  }, [user, queryClient]);
}
