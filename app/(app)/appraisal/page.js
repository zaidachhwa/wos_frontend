"use client";

import { useSearchParams } from "next/navigation";

import AppraisalDashboard from "@/components/appraisal/AppraisalDashboard";
import MyAppraisals from "@/components/appraisal/MyAppraisals";
import TeamAppraisals from "@/components/appraisal/TeamAppraisals";
import { useAuthStore } from "@/store/authStore";
import { TEAM_LEAD_ROLES, VIEW_ALL_ROLES, currentIstMonth } from "@/lib/appraisal";

// Role-based entry point: HR/admin/director get the org dashboard, team
// leads get their team's finalized appraisals plus their own, everyone
// else their own. The API enforces the same split server-side.
export default function AppraisalPage() {
  const role = useAuthStore((s) => s.user?.role);
  const searchParams = useSearchParams();
  const month = /^\d{4}-\d{2}$/.test(searchParams.get("month") || "") ? searchParams.get("month") : currentIstMonth();

  if (VIEW_ALL_ROLES.includes(role)) return <AppraisalDashboard initialMonth={month} />;
  if (TEAM_LEAD_ROLES.includes(role)) {
    return (
      <div className="mx-auto max-w-[900px] space-y-10">
        <TeamAppraisals initialMonth={month} />
        <MyAppraisals />
      </div>
    );
  }
  return <MyAppraisals />;
}
