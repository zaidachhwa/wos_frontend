"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitPullRequestArrow } from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Select } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { categorizeClientChange, fetchAppraisalSettings, fetchClientChanges } from "@/services/appraisalsService";
import { apiError } from "@/lib/appraisal";

// HR classifies *why* each client change happened. Only categories marked
// "counts against employee" in Settings affect the appraisal — a client
// changing their mind is never assumed to be the employee's fault.
export default function ClientChangesPanel({ month }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["client-changes", month, filter],
    queryFn: () => fetchClientChanges({ month, category: filter }),
  });
  const { data: config } = useQuery({ queryKey: ["appraisal-settings"], queryFn: fetchAppraisalSettings });
  const categories = config?.settings?.clientChangeCategories || [];

  const save = useMutation({
    mutationFn: categorizeClientChange,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-changes"] });
      queryClient.invalidateQueries({ queryKey: ["appraisals"] });
      toast.success("Category saved");
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div className="space-y-4">
      <div className="w-64">
        <Select label="Show" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All client changes</option>
          <option value="uncategorized">Not yet categorized</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      {isLoading ? (
        <Skeleton className="h-60 w-full rounded-card" />
      ) : tasks.length === 0 ? (
        <EmptyState icon={GitPullRequestArrow} heading="No client changes" description="Tasks flagged as client changes this month appear here." />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Assignees</th>
                <th className="px-4 py-3 font-medium">Category</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const cat = categories.find((c) => c.key === t.clientChangeCategory);
                return (
                  <tr key={t._id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2">
                      <p className="font-medium">{t.title}</p>
                      <p className="text-xs text-muted">{t.project?.name}</p>
                    </td>
                    <td className="px-4 py-2 text-muted">{(t.assignees || []).map((a) => a.name).join(", ") || "—"}</td>
                    <td className="px-4 py-2">
                      <select
                        aria-label={`Category for ${t.title}`}
                        value={t.clientChangeCategory || ""}
                        disabled={save.isPending}
                        onChange={(e) => save.mutate({ taskId: t._id, category: e.target.value || null })}
                        className="rounded-input border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary"
                      >
                        <option value="">Uncategorized</option>
                        {categories.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                            {c.countsAgainstEmployee ? " (counts against)" : ""}
                          </option>
                        ))}
                      </select>
                      {cat?.countsAgainstEmployee && <span className="ml-2 text-xs text-warning">affects score</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
