"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";

import AppraisalTabs from "@/components/appraisal/AppraisalTabs";
import ClientChangesPanel from "@/components/appraisal/ClientChangesPanel";
import MonthPicker from "@/components/appraisal/MonthPicker";
import MonthlyInputsGrid from "@/components/appraisal/MonthlyInputsGrid";
import EmptyState from "@/components/ui/EmptyState";
import { useAuthStore } from "@/store/authStore";
import { HR_ROLES, currentIstMonth } from "@/lib/appraisal";

export default function MonthlyInputsPage() {
  const isHr = HR_ROLES.includes(useAuthStore((s) => s.user?.role));
  const [month, setMonth] = useState(currentIstMonth);
  const [tab, setTab] = useState("inputs");

  if (!isHr) return <EmptyState icon={ShieldAlert} heading="HR only" description="Monthly appraisal inputs are entered by HR." />;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Monthly inputs</h1>
          <p className="mt-1 text-sm text-muted">
            Leaves and late marks entered here are the only values the appraisal uses for them — follow-ups and attendance are not read.
          </p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>
      <AppraisalTabs />
      <div className="flex gap-1 self-start rounded-btn border border-border bg-surface p-1">
        {[
          ["inputs", "Leaves & late marks"],
          ["client", "Client changes"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              tab === key ? "bg-primary text-primary-foreground" : "text-muted hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "inputs" ? <MonthlyInputsGrid month={month} /> : <ClientChangesPanel month={month} />}
    </div>
  );
}
