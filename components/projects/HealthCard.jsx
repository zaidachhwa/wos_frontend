"use client";

import { useMutation } from "@tanstack/react-query";
import { HeartPulse, Sparkles } from "lucide-react";

import Badge from "@/components/ui/Badge";
import { Button } from "@/components/ui/Field";
import { analyzeProjectHealth } from "@/services/aiService";

const RISK_TONES = { low: "success", medium: "warning", high: "danger" };

export default function HealthCard({ projectId }) {
  const health = useMutation({ mutationFn: () => analyzeProjectHealth(projectId) });
  const notConfigured = health.error?.response?.status === 503;

  return (
    <section className="rounded-card border border-border bg-surface p-6">
      <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight">
        <HeartPulse size={16} className="text-muted" /> Project health
      </h3>

      {health.data ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{health.data.healthScore}</p>
            <div>
              <p className="text-xs text-muted">out of 100</p>
              <Badge value={health.data.riskLevel} tone={RISK_TONES[health.data.riskLevel]} />
            </div>
          </div>
          {health.data.recommendations?.length > 0 && (
            <ul className="list-inside list-disc space-y-1 text-sm text-muted">
              {health.data.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">
          {notConfigured
            ? "AI is not configured yet — add a Gemini API key to the backend to enable this."
            : health.isError
              ? "The AI request failed. Try again in a moment."
              : "Let AI assess deadline risk, blocked work and completion rate."}
        </p>
      )}

      <div className="mt-3">
        <Button
          variant="secondary"
          disabled={health.isPending || notConfigured}
          onClick={() => health.mutate()}
        >
          <Sparkles size={15} />
          {health.isPending ? "Analyzing…" : health.data ? "Re-analyze" : "Analyze health"}
        </Button>
      </div>
    </section>
  );
}
