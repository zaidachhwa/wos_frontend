"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import useRealtime from "@/hooks/useRealtime";
import { useAuthStore } from "@/store/authStore";
import { fetchMe } from "@/services/authService";

export default function AppLayout({ children }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [checking, setChecking] = useState(!user);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useRealtime();

  useEffect(() => {
    if (user) return;
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (!cancelled) {
          setUser(me);
          setChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [user, setUser, router]);

  if (checking && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-40 animate-pulse rounded-btn bg-border" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
