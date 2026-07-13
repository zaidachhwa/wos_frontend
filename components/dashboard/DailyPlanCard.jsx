"use client";

import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import WidgetCard from "@/components/dashboard/WidgetCard";
import { Button } from "@/components/ui/Field";
import { generateDailyPlan } from "@/services/aiService";

export default function DailyPlanCard() {
  const plan = useMutation({ mutationFn: generateDailyPlan });
  const notConfigured = plan.error?.response?.status === 503;

  return (
    <WidgetCard title="AI daily plan">
      {plan.data ? (
        <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm">{plan.data}</p>
      ) : (
        <p className="text-sm text-muted">
          {notConfigured
            ? "AI is not configured yet — add a Gemini API key to the backend to enable this."
            : plan.isError
              ? "The AI request failed. Try again in a moment."
              : "Generate a prioritized plan for your day from your tasks, deadlines and schedule."}
        </p>
      )}
      <div className="mt-3">
        <Button variant="secondary" disabled={plan.isPending || notConfigured} onClick={() => plan.mutate()}>
          <Sparkles size={15} />
          {plan.isPending ? "Thinking…" : plan.data ? "Regenerate" : "Generate plan"}
        </Button>
      </div>
    </WidgetCard>
  );
}
