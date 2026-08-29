"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Badge from "@/components/ui/Badge";
import { Input, Textarea, Button } from "@/components/ui/Field";
import { saveFollowUp, fetchFollowUpSuggestion, fetchFollowUps } from "@/services/followupService";
import { fetchProjects } from "@/services/projectService";
import { getCurrentLocation } from "@/lib/geolocation";
import useToast from "@/hooks/useToast";

const dayBefore = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  const pad = (n) => String(n).padStart(2, "0");
  return `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}-${pad(prev.getUTCDate())}`;
};

const FIELDS = {
  morning: [
    ["yesterdayCompleted", "Yesterday I completed", "textarea"],
    ["todayPlan", "Today's plan", "textarea"],
    ["blockers", "Current blockers", "textarea"],
    ["estimatedHours", "Estimated working hours", "number"],
  ],
  evening: [
    ["completedWork", "Completed work", "textarea"],
    ["remainingWork", "Remaining work", "textarea"],
    ["tomorrowPlan", "Tomorrow's plan", "textarea"],
    ["actualHours", "Actual hours worked", "number"],
    ["challenges", "Challenges faced", "textarea"],
  ],
};

export default function FollowUpCard({ type, date, followUp, requireLocation = false }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [apiError, setApiError] = useState("");
  const [locating, setLocating] = useState(false);
  const status = followUp?.status || "draft";
  const locked = status === "reviewed";

  const { data: suggestion } = useQuery({
    queryKey: ["followup-suggestion", date],
    queryFn: () => fetchFollowUpSuggestion(date),
    enabled: type === "morning" && !locked,
  });

  const yesterday = dayBefore(date);
  const { data: yesterdayEvening } = useQuery({
    queryKey: ["followups", "own", yesterday, "evening"],
    queryFn: async () => (await fetchFollowUps({ date: yesterday, type: "evening" }))[0] ?? null,
    enabled: type === "morning" && !locked,
  });

  // Fetch all projects for the Evening Follow-up Project Selection
  const { data: activeProjects } = useQuery({
    queryKey: ["projects", "active"],
    queryFn: fetchProjects,
    enabled: type === "evening" && !locked,
  });

  const { register, handleSubmit, watch, setValue, getValues } = useForm({
    values: FIELDS[type].reduce((acc, [name]) => {
      const existing = followUp?.[type]?.[name] ?? "";
      let value = existing;
      if (type === "morning" && name === "yesterdayCompleted") {
        value = existing || yesterdayEvening?.evening?.completedWork || suggestion?.yesterdayCompleted || "";
      } else if (type === "morning" && name === "todayPlan") {
        value = existing || yesterdayEvening?.evening?.remainingWork || "";
      }
      return { ...acc, [name]: value };
    }, {}),
    resetOptions: { keepDirtyValues: true },
  });

  // State to manage selected projects manually
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [projectTimes, setProjectTimes] = useState({});

  useEffect(() => {
    if (type === "evening" && followUp?.evening?.projects) {
      const ids = [];
      const times = {};
      followUp.evening.projects.forEach((p) => {
        const id = p.project?._id || p.project;
        if (id) {
          ids.push(id);
          times[id] = { hours: p.hours || 0, minutes: p.minutes || 0 };
        }
      });
      setSelectedProjectIds(ids);
      setProjectTimes(times);
    }
  }, [type, followUp]);

  const handleProjectToggle = (projectId) => {
    setSelectedProjectIds((prev) => {
      if (prev.includes(projectId)) {
        const newIds = prev.filter((id) => id !== projectId);
        const newTimes = { ...projectTimes };
        delete newTimes[projectId];
        setProjectTimes(newTimes);
        return newIds;
      }
      return [...prev, projectId];
    });
  };

  const handleTimeChange = (projectId, field, value) => {
    setProjectTimes((prev) => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        [field]: Number(value) || 0,
      },
    }));
  };

  const getTotalMinutes = () => {
    return Object.values(projectTimes).reduce((acc, curr) => acc + ((curr.hours || 0) * 60) + (curr.minutes || 0), 0);
  };

  const totalMinutesWorked = getTotalMinutes();
  const totalHoursDisplay = Math.floor(totalMinutesWorked / 60);
  const totalMinsDisplay = totalMinutesWorked % 60;

  const mutation = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: ({ values, submit, location }) => {
      const data = { ...values };
      const hoursField = type === "morning" ? "estimatedHours" : "actualHours";
      data[hoursField] = data[hoursField] === "" ? undefined : Number(data[hoursField]);

      if (type === "evening") {
        data.projects = selectedProjectIds.map((id) => {
          const hours = projectTimes[id]?.hours || 0;
          const minutes = projectTimes[id]?.minutes || 0;
          return {
            project: id,
            hours,
            minutes,
            totalMinutes: (hours * 60) + minutes,
          };
        });
      }

      return saveFollowUp({ date, type, data, submit, location });
    },
    onSuccess: (_data, { submit }) => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      toast.success(submit ? "Follow-up submitted" : "Draft saved");
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Something went wrong";
      setApiError(message);
      toast.error(message);
    },
  });

  const submitWithLocation = handleSubmit(async (values) => {
    if (type === "evening" && totalMinutesWorked < 480) {
      setApiError("Your total recorded working time is less than 8 hours. Please complete at least 8 hours before submitting your Evening Follow-up.");
      toast.error("Minimum 8 hours required to submit.");
      return;
    }

    if (!requireLocation) {
      mutation.mutate({ values, submit: true });
      return;
    }
    setApiError("");
    setLocating(true);
    try {
      const location = await getCurrentLocation();
      mutation.mutate({ values, submit: true, location });
    } catch (error) {
      setApiError(error.message);
      toast.error(error.message);
    } finally {
      setLocating(false);
    }
  });

  const saveDraft = handleSubmit((values) => mutation.mutate({ values, submit: false }));

  return (
    <section className="rounded-card border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold capitalize tracking-tight">{type} follow-up</h3>
        <Badge value={followUp ? status : "missing"} />
      </div>

      {locked ? (
        <div className="mt-4 space-y-4 text-sm">
          {type === "evening" && followUp?.evening?.projects && followUp.evening.projects.length > 0 && (
            <div className="rounded-md border border-border p-3">
              <p className="mb-2 text-xs font-semibold text-muted">Projects Worked On</p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="pb-2 font-medium">Project</th>
                    <th className="pb-2 font-medium">Time Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {followUp.evening.projects.map((p, idx) => (
                    <tr key={idx} className="border-b border-border/50 last:border-0">
                      <td className="py-2">{p.project?.name || "Unknown Project"}</td>
                      <td className="py-2">{p.hours}h {p.minutes}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 text-right text-xs font-semibold">
                Total Worked: {Math.floor(followUp.evening.projects.reduce((acc, p) => acc + p.totalMinutes, 0) / 60)}h {followUp.evening.projects.reduce((acc, p) => acc + p.totalMinutes, 0) % 60}m
              </div>
            </div>
          )}

          <div className="space-y-3">
            {FIELDS[type].map(([name, label]) => (
              <div key={name}>
                <p className="text-xs text-muted">{label}</p>
                <p className="mt-0.5 whitespace-pre-wrap">{String(followUp?.[type]?.[name] ?? "—")}</p>
              </div>
            ))}
          </div>

          {followUp?.managerComment && (
            <div className="rounded-input border border-success/30 bg-success/5 px-3 py-2">
              <p className="text-xs font-medium text-success">Manager comment</p>
              <p className="mt-0.5 whitespace-pre-wrap">{followUp.managerComment}</p>
            </div>
          )}
        </div>
      ) : (
        <form className="mt-4 space-y-4" noValidate>
          {apiError && (
            <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {apiError}
            </p>
          )}
          
          {type === "evening" && (
            <div className="rounded-md border border-border p-4 bg-muted/20">
              <h4 className="mb-3 text-sm font-semibold">Select Projects Worked On</h4>
              
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {activeProjects?.map((proj) => (
                  <div key={proj._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded hover:bg-muted/30 transition">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(proj._id)}
                        onChange={() => handleProjectToggle(proj._id)}
                        className="rounded border-border accent-primary w-4 h-4"
                      />
                      <span className="font-medium">{proj.name}</span>
                    </label>
                    
                    {selectedProjectIds.includes(proj._id) && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          placeholder="Hours"
                          value={projectTimes[proj._id]?.hours || ""}
                          onChange={(e) => handleTimeChange(proj._id, "hours", e.target.value)}
                          className="w-20 rounded-input border border-border bg-surface px-2 py-1 text-sm focus:border-primary focus:outline-none"
                        />
                        <span className="text-xs text-muted">h</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          placeholder="Mins"
                          value={projectTimes[proj._id]?.minutes || ""}
                          onChange={(e) => handleTimeChange(proj._id, "minutes", e.target.value)}
                          className="w-20 rounded-input border border-border bg-surface px-2 py-1 text-sm focus:border-primary focus:outline-none"
                        />
                        <span className="text-xs text-muted">m</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selectedProjectIds.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
                  <span className="text-sm font-semibold">Total Time Today:</span>
                  <span className={`text-sm font-bold ${totalMinutesWorked < 480 ? "text-danger" : "text-success"}`}>
                    {totalHoursDisplay} Hours {totalMinsDisplay} Minutes
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {FIELDS[type].map(([name, label, kind]) =>
              kind === "number" ? (
                <Input key={name} label={label} type="number" min="0" step="0.5" {...register(name)} />
              ) : (
                <Textarea key={name} label={label} rows={2} {...register(name)} />
              )
            )}
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              type="button"
              disabled={mutation.isPending}
              onClick={saveDraft}
            >
              Save draft
            </Button>
            <Button type="button" disabled={mutation.isPending || locating} onClick={submitWithLocation}>
              {locating ? "Getting location…" : status === "submitted" ? "Resubmit" : "Submit"}
            </Button>
          </div>
          {status === "submitted" && (
            <p className="mt-2 text-right text-xs text-muted">
              Submitted {followUp?.submittedAt ? new Date(followUp.submittedAt).toLocaleTimeString() : ""} — you can
              still edit until it&apos;s reviewed.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
