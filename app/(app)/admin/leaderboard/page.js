"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Trophy, AlertTriangle } from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Input, Button } from "@/components/ui/Field";
import { fetchPointsConfig, updatePointsConfig } from "@/services/leaderboardService";
import { fetchTeams, updateTeamThresholds } from "@/services/orgService";
import { useAuthStore } from "@/store/authStore";

const PRIORITIES = ["low", "medium", "high"];
const PENALTY_FIELDS = [
  ["completedLate", "Completed late"],
  ["overdue", "Went overdue (still open)"],
  ["bug", "Bug logged"],
];

// Per-team threshold editor — each team saves independently so you can tune
// bands differently for different teams (e.g. a senior team vs a new team).
function TeamThresholdRow({ team }) {
  const queryClient = useQueryClient();
  const [red, setRed] = useState(String(team.performanceThresholds?.red ?? 50));
  const [yellow, setYellow] = useState(String(team.performanceThresholds?.yellow ?? 85));
  const [feedback, setFeedback] = useState(null);

  const mutation = useMutation({
    mutationFn: (payload) => updateTeamThresholds({ id: team._id, ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setFeedback({ ok: true, message: "Saved" });
      setTimeout(() => setFeedback(null), 2500);
    },
    onError: (e) =>
      setFeedback({ ok: false, message: e.response?.data?.message || "Something went wrong" }),
  });

  const redNum = Number(red);
  const yellowNum = Number(yellow);
  const valid =
    Number.isFinite(redNum) &&
    Number.isFinite(yellowNum) &&
    redNum >= 0 &&
    yellowNum <= 100 &&
    redNum < yellowNum;

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-input border border-border bg-background/60 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{team.name}</p>
        {/* Live preview of what the current inputs produce */}
        <p className="mt-0.5 text-xs text-muted">
          <span className="font-medium text-danger">Red</span>
          {" < "}
          {redNum}
          {" · "}
          <span className="font-medium text-warning">Yellow</span>
          {" "}
          {redNum}–{yellowNum - 1}
          {" · "}
          <span className="font-medium text-success">Green</span>
          {" ≥ "}
          {yellowNum}
        </p>
      </div>

      <div className="flex items-end gap-3">
        <div className="w-28">
          <Input
            label="Red below"
            type="number"
            min="0"
            max="99"
            step="1"
            value={red}
            onChange={(e) => {
              setRed(e.target.value);
              setFeedback(null);
            }}
          />
        </div>
        <div className="w-28">
          <Input
            label="Yellow below"
            type="number"
            min="1"
            max="100"
            step="1"
            value={yellow}
            onChange={(e) => {
              setYellow(e.target.value);
              setFeedback(null);
            }}
          />
        </div>
        <Button
          disabled={mutation.isPending || !valid}
          onClick={() => mutation.mutate({ red: redNum, yellow: yellowNum })}
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      {!valid && red && yellow && (
        <p className="w-full text-xs text-danger">
          Red must be less than Yellow, and both must be in range 0–100.
        </p>
      )}
      {feedback && (
        <p className={`w-full text-xs ${feedback.ok ? "text-success" : "text-danger"}`}>
          {feedback.message}
        </p>
      )}
    </div>
  );
}

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

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
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
    onError: (e) =>
      setFeedback({ ok: false, message: e.response?.data?.message || "Something went wrong" }),
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
            pointsByPriority: Object.fromEntries(
              PRIORITIES.map((p) => [p, Number(effective.pointsByPriority[p])])
            ),
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
              feedback.ok
                ? "border-success/30 bg-success/5 text-success"
                : "border-danger/30 bg-danger/5 text-danger"
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

      {/* Performance Band Thresholds — per-team, saved independently */}
      <section className="rounded-card border border-border bg-surface p-6">
        <div className="flex items-center gap-2">
          <span className="flex gap-0.5 text-lg leading-none">
            <span className="text-danger">●</span>
            <span className="text-warning">●</span>
            <span className="text-success">●</span>
          </span>
          <h3 className="text-base font-semibold tracking-tight">Performance band thresholds</h3>
        </div>
        <p className="mt-1 text-sm text-muted">
          Monthly appraisal score cutoffs, per team. A score below{" "}
          <strong className="text-danger">Red</strong> is Red, below{" "}
          <strong className="text-warning">Yellow</strong> is Yellow, and at or above{" "}
          <strong className="text-warning">Yellow</strong> is{" "}
          <strong className="text-success">Green</strong>.
        </p>
        <div className="mt-4 space-y-3">
          {teamsLoading ? (
            <Skeleton className="h-16 w-full rounded-input" />
          ) : teams.length === 0 ? (
            <p className="text-sm text-muted">No teams yet. Create teams first.</p>
          ) : (
            teams.map((team) => <TeamThresholdRow key={team._id} team={team} />)
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          Recommended:{" "}
          <strong>Red &lt; 50</strong> · <strong>Yellow &lt; 85</strong> · <strong>Green ≥ 85</strong>.
          Changes take effect immediately — no server restart needed.
        </p>
      </section>
    </div>
  );
}
