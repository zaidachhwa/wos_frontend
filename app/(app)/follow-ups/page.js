"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import FollowUpCard from "@/components/followups/FollowUpCard";
import FollowUpHistory from "@/components/followups/FollowUpHistory";
import TeamFollowUps from "@/components/followups/TeamFollowUps";
import Skeleton from "@/components/ui/Skeleton";
import { useAuthStore } from "@/store/authStore";
import { fetchFollowUps } from "@/services/followupService";

const localDay = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function FollowUpsPage() {
  const me = useAuthStore((s) => s.user);
  const hasTeamView = ["admin", "manager", "sublead"].includes(me?.role);
  const canReview = ["admin", "manager"].includes(me?.role);
  const [tab, setTab] = useState("mine");
  const today = localDay();

  const { data: own, isLoading } = useQuery({
    queryKey: ["followups", "own", today],
    queryFn: () => fetchFollowUps({ date: today }),
  });
  const { data: history } = useQuery({
    queryKey: ["followups", "own", "history"],
    queryFn: () => fetchFollowUps({}),
    enabled: tab === "mine",
  });

  const byType = (type) => (own || []).find((f) => f.type === type);
  const pastFollowUps = (history || []).filter((f) => f.date !== today && f.status !== "draft");

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {hasTeamView && (
        <div className="flex gap-1 self-start rounded-btn border border-border bg-surface p-1">
          {[
            ["mine", "My follow-ups"],
            ["team", "Team"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                tab === key ? "bg-primary text-primary-foreground" : "text-muted hover:text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "mine" ? (
        isLoading ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-80 w-full rounded-card" />
            <Skeleton className="h-80 w-full rounded-card" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <FollowUpCard type="morning" date={today} followUp={byType("morning")} />
              <FollowUpCard type="evening" date={today} followUp={byType("evening")} />
            </div>
            <div className="mt-6">
              <h3 className="mb-3 text-base font-semibold tracking-tight">Previous follow-ups</h3>
              <FollowUpHistory followUps={pastFollowUps} />
            </div>
          </>
        )
      ) : (
        <TeamFollowUps today={today} canReview={canReview} />
      )}
    </div>
  );
}
