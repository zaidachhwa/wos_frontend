"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Trophy } from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Input, Button } from "@/components/ui/Field";
import { fetchPointsConfig, updatePointsConfig } from "@/services/leaderboardService";
import { useAuthStore } from "@/store/authStore";

const PRIORITIES = ["low", "medium", "high", "critical"];

export default function AdminLeaderboardPage() {
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === "admin";
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["points-config"],
    queryFn: fetchPointsConfig,
    enabled: isAdmin,
  });

  const effective = draft ?? data;

  const mutation = useMutation({
    mutationFn: updatePointsConfig,
    onSuccess: (updated) => {
      queryClient.setQueryData(["points-config"], updated);
      setFeedback({ ok: true, message: "Point values updated." });
    },
    onError: (e) => setFeedback({ ok: false, message: e.response?.data?.message || "Something went wrong" }),
  });

  if (!isAdmin) {
    return (
      <EmptyState icon={ShieldAlert} heading="Admins only" description="This section is restricted to admins." />
    );
  }

  if (isLoading || !effective) {
    return <Skeleton className="h-64 w-full rounded-card" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="rounded-card border border-border bg-surface p-6">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-warning" />
          <h3 className="text-base font-semibold tracking-tight">Leaderboard points</h3>
        </div>
        <p className="mt-1 text-sm text-muted">
          Points awarded per task priority when marked completed. Changes apply to future completions.
        </p>
        <form
          className="mt-4 space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setFeedback(null);
            mutation.mutate({
              low: Number(effective.low),
              medium: Number(effective.medium),
              high: Number(effective.high),
              critical: Number(effective.critical),
            });
          }}
        >
          {feedback && (
            <p
              role={feedback.ok ? "status" : "alert"}
              className={`rounded-input border px-3 py-2 text-sm ${
                feedback.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"
              }`}
            >
              {feedback.message}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            {PRIORITIES.map((p) => (
              <Input
                key={p}
                label={p[0].toUpperCase() + p.slice(1)}
                type="number"
                min="0"
                step="1"
                value={effective[p]}
                onChange={(e) => setDraft({ ...effective, [p]: e.target.value })}
              />
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              Save points
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
