"use client";

import { useState } from "react";

import BonusRequestList from "@/components/people/BonusRequestList";
import MyBonusRequest from "@/components/people/MyBonusRequest";
import { useAuthStore } from "@/store/authStore";

const REVIEWER_ROLES = ["admin", "hr", "director"];

export default function BonusRequestsPage() {
  const isReviewer = REVIEWER_ROLES.includes(useAuthStore((s) => s.user?.role));
  const [tab, setTab] = useState(isReviewer ? "all" : "mine");

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Special bonus request</h1>
        <p className="mt-1 text-sm text-muted">Once a month, between the 25th and the last day of the month (IST).</p>
      </div>
      {isReviewer && (
        <div className="flex gap-1 self-start rounded-btn border border-border bg-surface p-1">
          {[
            ["all", "All requests"],
            ["mine", "My request"],
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
      )}
      {isReviewer && tab === "all" ? <BonusRequestList /> : <MyBonusRequest />}
    </div>
  );
}
