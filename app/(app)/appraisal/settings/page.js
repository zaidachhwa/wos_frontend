"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";

import AppraisalTabs from "@/components/appraisal/AppraisalTabs";
import AutomationCard from "@/components/appraisal/settings/AutomationCard";
import BugPenaltiesCard from "@/components/appraisal/settings/BugPenaltiesCard";
import ClassificationsCard from "@/components/appraisal/settings/ClassificationsCard";
import ClientCategoriesCard from "@/components/appraisal/settings/ClientCategoriesCard";
import CriteriaTable from "@/components/appraisal/settings/CriteriaTable";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { useAuthStore } from "@/store/authStore";
import { fetchAppraisalSettings } from "@/services/appraisalsService";
import { HR_ROLES } from "@/lib/appraisal";

const TABS = [
  ["criteria", "Criteria"],
  ["bugs", "Bug penalties"],
  ["classification", "Performance classification"],
  ["client", "Client changes"],
  ["automation", "Automation"],
];

export default function AppraisalSettingsPage() {
  const isHr = HR_ROLES.includes(useAuthStore((s) => s.user?.role));
  const [tab, setTab] = useState("criteria");
  const { data, isLoading } = useQuery({ queryKey: ["appraisal-settings"], queryFn: fetchAppraisalSettings, enabled: isHr });

  if (!isHr) return <EmptyState icon={ShieldAlert} heading="HR only" description="Appraisal settings are managed by HR." />;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Appraisal settings</h1>
        <p className="mt-1 text-sm text-muted">
          How monthly scores are calculated. Changes apply to appraisals not yet finalized; finalized appraisals keep a snapshot of the settings
          they used (version {data?.settings?.version ?? "—"}).
        </p>
      </div>
      <AppraisalTabs />
      <div className="flex flex-wrap gap-1 self-start rounded-btn border border-border bg-surface p-1">
        {TABS.map(([key, label]) => (
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

      {isLoading || !data ? (
        <Skeleton className="h-96 w-full rounded-card" />
      ) : (
        // key on the settings version: a successful save remounts the card
        // with the server's (validated, normalized) values.
        <div key={data.settings.version}>
          {tab === "criteria" && <CriteriaTable criteria={data.criteria} weightage={data.weightage} catalog={data.catalog} />}
          {tab === "bugs" && <BugPenaltiesCard settings={data.settings} bugStatuses={data.catalog.bugStatuses} />}
          {tab === "classification" && <ClassificationsCard settings={data.settings} />}
          {tab === "client" && <ClientCategoriesCard settings={data.settings} />}
          {tab === "automation" && <AutomationCard settings={data.settings} />}
        </div>
      )}
    </div>
  );
}
