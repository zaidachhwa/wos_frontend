"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox } from "lucide-react";

import { CATEGORY_LABELS } from "@/components/people/AnonymousFeedbackForm";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Button, Select } from "@/components/ui/Field";
import { fetchFeedbackInbox, setFeedbackStatus } from "@/services/peopleService";

const fmtDay = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

// HR/Admin inbox. There is no sender to show — the server never stored one.
export default function FeedbackInbox() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("new");
  const [category, setCategory] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["feedback-inbox", status, category],
    queryFn: () => fetchFeedbackInbox({ status: status || undefined, category: category || undefined }),
  });
  const mark = useMutation({
    mutationFn: setFeedbackStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feedback-inbox"] }),
  });
  const items = data?.feedback || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Select label="Show" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="new">New{data ? ` (${data.counts.new})` : ""}</option>
            <option value="reviewed">Reviewed</option>
            <option value="">All</option>
          </Select>
        </div>
        <div className="w-52">
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-card" />
      ) : items.length === 0 ? (
        <EmptyState icon={Inbox} heading="No feedback here" />
      ) : (
        <ul className="space-y-2">
          {items.map((f) => (
            <li key={f._id} className="rounded-card border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Badge value={CATEGORY_LABELS[f.category] || f.category} tone="info" />
                  <span>Anonymous · {fmtDay(f.day)}</span>
                </div>
                <Button
                  variant="ghost"
                  className="text-xs"
                  disabled={mark.isPending}
                  onClick={() => mark.mutate({ id: f._id, status: f.status === "new" ? "reviewed" : "new" })}
                >
                  {f.status === "new" ? "Mark reviewed" : "Mark as new"}
                </Button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{f.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
