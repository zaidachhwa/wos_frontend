"use client";

import { useState } from "react";

import AnonymousFeedbackForm from "@/components/people/AnonymousFeedbackForm";
import FeedbackInbox from "@/components/people/FeedbackInbox";
import { useAuthStore } from "@/store/authStore";

const INBOX_ROLES = ["admin", "hr"];

export default function FeedbackPage() {
  const canReadInbox = INBOX_ROLES.includes(useAuthStore((s) => s.user?.role));
  const [tab, setTab] = useState("send");

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Anonymous feedback</h1>
        <p className="mt-1 text-sm text-muted">Share anything with HR and management — your name is never attached.</p>
      </div>
      {canReadInbox && (
        <div className="flex gap-1 self-start rounded-btn border border-border bg-surface p-1">
          {[
            ["send", "Send feedback"],
            ["inbox", "Inbox"],
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
      {canReadInbox && tab === "inbox" ? <FeedbackInbox /> : <AnonymousFeedbackForm />}
    </div>
  );
}
