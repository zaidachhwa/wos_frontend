"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";

import AppraisalTabs from "@/components/appraisal/AppraisalTabs";
import DirectorBonusGrid from "@/components/appraisal/DirectorBonusGrid";
import MonthPicker from "@/components/appraisal/MonthPicker";
import EmptyState from "@/components/ui/EmptyState";
import { useAuthStore } from "@/store/authStore";
import { currentIstMonth } from "@/lib/appraisal";

const ROLES = ["director", "hr", "admin"];

export default function DirectorBonusPage() {
  const role = useAuthStore((s) => s.user?.role);
  const [month, setMonth] = useState(currentIstMonth);
  if (!ROLES.includes(role)) return <EmptyState icon={ShieldAlert} heading="Not available" description="For Directors, HR and Admin." />;

  return (
    <div className="mx-auto max-w-[1300px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Director&apos;s assessment & special bonus</h1>
          <p className="mt-1 text-sm text-muted">
            {role === "hr" ? "HR can add a special bonus %; the Director's 20% is entered by the Director." : "Give each team member up to 20 points, and add a special bonus % where deserved."}
          </p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>
      <AppraisalTabs />
      <DirectorBonusGrid month={month} />
    </div>
  );
}
