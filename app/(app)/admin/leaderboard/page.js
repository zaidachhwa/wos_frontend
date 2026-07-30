"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Trophy, AlertTriangle } from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Input, Button } from "@/components/ui/Field";
import { fetchPointsConfig, updatePointsConfig } from "@/services/leaderboardService";
import { useAuthStore } from "@/store/authStore";

const PRIORITIES = ["low", "medium", "high", "critical"];
const PENALTY_FIELDS = [
  ["completedLate", "Completed late"],
  ["overdue", "Went overdue (still open)"],
  ["bug", "Bug logged"],
];

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
      setDraft(null);
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
      <form
        className="space-y-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setFeedback(null);
          mutation.mutate({
            pointsByPriority: Object.fromEntries(PRIORITIES.map((p) => [p, Number(effective.pointsByPriority[p])])),
            penalties: Object.fromEntries(
              PENALTY_FIELDS.map(([key]) => [key, Number(effective.penalties[key])])
            ),
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

        <section className="rounded-card border border-border bg-surface p-6">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-warning" />
            <h3 className="text-base font-semibold tracking-tight">Leaderboard points</h3>
          </div>
          <p className="mt-1 text-sm text-muted">
            Points awarded per task priority when marked completed. Changes apply to future completions.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {PRIORITIES.map((p) => (
              <Input
                key={p}
                label={p[0].toUpperCase() + p.slice(1)}
                type="number"
                min="0"
                step="1"
                value={effective.pointsByPriority[p]}
                onChange={(e) =>
                  setDraft({
                    ...effective,
                    pointsByPriority: { ...effective.pointsByPriority, [p]: e.target.value },
                  })
                }
              />
            ))}
          </div>
        </section>

        <section className="rounded-card border border-border bg-surface p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-danger" />
            <h3 className="text-base font-semibold tracking-tight">Penalties</h3>
          </div>
          <p className="mt-1 text-sm text-muted">
            Points deducted for each accountability event. The overdue penalty fires once, live, the moment a
            task's deadline passes while still open; the bug penalty fires once, the moment a bug is logged.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {PENALTY_FIELDS.map(([key, label]) => (
              <Input
                key={key}
                label={label}
                type="number"
                min="0"
                step="1"
                value={effective.penalties[key]}
                onChange={(e) =>
                  setDraft({ ...effective, penalties: { ...effective.penalties, [key]: e.target.value } })
                }
              />
            ))}
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
