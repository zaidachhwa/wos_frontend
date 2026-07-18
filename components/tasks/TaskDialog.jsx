"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import Dialog from "@/components/ui/Dialog";
import { Input, Textarea, Select, Button } from "@/components/ui/Field";
import { createTask, fetchTasks } from "@/services/taskService";
import { fetchModules } from "@/services/projectService";

const REPEAT_OPTIONS = [
  ["none", "None"],
  ["daily", "Daily"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
];

const schema = yup.object({
  project: yup.string().required("Project is required"),
  title: yup.string().trim().required("Title is required"),
});

export default function TaskDialog({ open, onClose: onCloseProp, projects, directory, task }) {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState("");

  const onClose = () => {
    setApiError("");
    onCloseProp();
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: yupResolver(schema) });

  const projectId = watch("project");
  const { data: modules = [] } = useQuery({
    queryKey: ["modules", projectId],
    queryFn: () => fetchModules(projectId),
    enabled: open && Boolean(projectId),
  });
  const { data: projectTasks = [] } = useQuery({
    queryKey: ["tasks", { project: projectId }],
    queryFn: () => fetchTasks({ project: projectId }),
    enabled: open && Boolean(projectId),
  });
  const blockableTasks = projectTasks.filter((t) => t._id !== task?._id);

  useEffect(() => {
    if (open) {
      reset({
        project: task?.project || "",
        module: task?.module || "",
        title: task?.title || "",
        description: task?.description || "",
        assignees: task?.assignees?.map((a) => a._id || a) || [],
        priority: task?.priority || "medium",
        estimatedHours: task?.estimatedHours ?? "",
        deadline: task?.deadline ? task.deadline.slice(0, 10) : "",
        labels: task?.labels?.join(", ") || "",
        blockedBy: task?.blockedBy?.map((b) => b._id || b) || [],
        recurrence: task?.recurrence?.frequency || "none",
      });
    }
  }, [open, reset, task]);

  const mutation = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: (values) =>
      createTask({
        ...values,
        module: values.module || null,
        estimatedHours: values.estimatedHours ? Number(values.estimatedHours) : undefined,
        deadline: values.deadline || null,
        labels: values.labels
          ? values.labels.split(",").map((l) => l.trim()).filter(Boolean)
          : [],
        recurrence: values.recurrence && values.recurrence !== "none" ? { frequency: values.recurrence, interval: 1 } : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
    onError: (error) => setApiError(error.response?.data?.message || "Something went wrong"),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New task"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isSubmitting || mutation.isPending} onClick={handleSubmit((v) => mutation.mutate(v))}>
            Create task
          </Button>
        </>
      }
    >
      <form className="space-y-4" noValidate>
        {apiError && (
          <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {apiError}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Project" error={errors.project?.message} {...register("project")}>
            <option value="">Select project…</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select label="Module" {...register("module")}>
            <option value="">None</option>
            {modules.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <Input label="Title" error={errors.title?.message} {...register("title")} />
        <Textarea label="Description" {...register("description")} />
        <div className="gap-4">
          <Select label="Assignees" multiple size={Math.min(4, directory.length || 1)} {...register("assignees")}>
            {directory.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        {Boolean(projectId) && (
          <div className="gap-4">
            <Select
              label="Blocked by"
              multiple
              size={Math.min(4, blockableTasks.length || 1)}
              {...register("blockedBy")}
            >
              {blockableTasks.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Select label="Priority" {...register("priority")}>
            {["low", "medium", "high", "critical"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <Input label="Est. hours" type="number" min="0" step="0.5" {...register("estimatedHours")} />
          <Input label="Deadline" type="date" {...register("deadline")} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Labels (comma-separated)" placeholder="frontend, urgent" {...register("labels")} />
          <Select label="Repeats" {...register("recurrence")}>
            {REPEAT_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </form>
    </Dialog>
  );
}
