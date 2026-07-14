"use client";

import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import WidgetCard from "@/components/dashboard/WidgetCard";
import { Button } from "@/components/ui/Field";
import Markdown from "@/components/shared/Markdown";
import { analyzeWorkload } from "@/services/aiService";

export default function WorkloadCard({ workload }) {
  const analysis = useMutation({ mutationFn: analyzeWorkload });
  const notConfigured = analysis.error?.response?.status === 503;
  const max = Math.max(1, ...(workload || []).map((w) => w.estimatedHours || 0));

  return (
    <WidgetCard title="Team workload" href="/team">
      {workload?.length ? (
        <ul className="space-y-2">
          {workload.map((w) => (
            <li key={w.user._id} className="text-sm">
              <div className="flex items-center justify-between">
                <span>{w.user.name}</span>
                <span className="text-xs tabular-nums text-muted">
                  {w.openTasks} tasks · {w.estimatedHours}h
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-info transition-[width] duration-250 ease-out"
                  style={{ width: `${Math.round(((w.estimatedHours || 0) / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No reports with assigned work.</p>
      )}

      {analysis.data && (
        <div className="mt-3 max-h-40 overflow-y-auto rounded-input border border-border bg-background/60 px-3 py-2">
          <Markdown text={analysis.data} />
        </div>
      )}
      {workload?.length > 0 && (
        <div className="mt-3">
          <Button
            variant="secondary"
            disabled={analysis.isPending || notConfigured}
            onClick={() => analysis.mutate()}
          >
            <Sparkles size={15} />
            {notConfigured ? "AI not configured" : analysis.isPending ? "Analyzing…" : "Analyze with AI"}
          </Button>
        </div>
      )}
    </WidgetCard>
  );
}
