"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, AlertTriangle } from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { fetchDepartmentViolations } from "@/services/departmentViolationService";
import { useAuthStore } from "@/store/authStore";

export default function DepartmentViolationsPage() {
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === "admin";

  const { data: violations = [], isLoading } = useQuery({
    queryKey: ["department-violations"],
    queryFn: fetchDepartmentViolations,
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <EmptyState icon={ShieldAlert} heading="Admins only" description="This section is restricted to admins." />
    );
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-card" />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-card border border-border bg-surface p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-warning" />
          <h3 className="text-base font-semibold tracking-tight">Cross-department projects</h3>
        </div>
        <p className="mt-1 text-sm text-muted">
          Projects flagged by the department-segregation migration as spanning more than one department. These
          existed before segregation was enforced and were left as-is — review and reassign members as needed.
        </p>
        {violations.length ? (
          <ul className="mt-4 space-y-2">
            {violations.map((v) => (
              <li key={v._id} className="rounded-input border border-border/60 bg-background/60 px-3 py-2 text-sm">
                <span className="font-medium">{v.project?.name || "Deleted project"}</span>
                <span className="ml-2 text-muted">
                  spans: {v.departments.filter(Boolean).map((d) => d.name).join(", ") || "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">No cross-department projects flagged.</p>
        )}
      </section>
    </div>
  );
}
