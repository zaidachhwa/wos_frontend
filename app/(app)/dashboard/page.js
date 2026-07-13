"use client";

import { useQuery } from "@tanstack/react-query";

import AdminDashboard from "@/components/dashboard/AdminDashboard";
import ManagerDashboard from "@/components/dashboard/ManagerDashboard";
import MemberDashboard from "@/components/dashboard/MemberDashboard";
import Skeleton from "@/components/ui/Skeleton";
import { useAuthStore } from "@/store/authStore";
import { fetchDashboard } from "@/services/dashboardService";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div>
        <p className="text-sm text-muted">Welcome back,</p>
        <h2 className="mt-0.5 text-2xl font-semibold tracking-tight">{user?.name}</h2>
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-card" />
          ))}
        </div>
      ) : user?.role === "admin" ? (
        <AdminDashboard data={data} />
      ) : user?.role === "member" ? (
        <MemberDashboard data={data} />
      ) : (
        <ManagerDashboard data={data} />
      )}
    </div>
  );
}
