"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import Dialog from "@/components/ui/Dialog";
import { Input, Textarea, Select, Button } from "@/components/ui/Field";
import MultiSelect from "@/components/ui/MultiSelect";
import ClockPicker from "@/components/ui/ClockPicker";
import { createTask, fetchTasks } from "@/services/taskService";
import { fetchModules } from "@/services/projectService";
import { useAuthStore } from "@/store/authStore";
import useToast from "@/hooks/useToast";

const REPEAT_OPTIONS = [
  ["none", "None"],
  ["daily", "Daily"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
];

// Rounded to the nearest 5 minutes so the default always lands on one of
// ClockPicker's minute marks.
const nowTimeStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const rounded = (Math.round((d.getHours() * 60 + d.getMinutes()) / 5) * 5) % 1440;
  return `${pad(Math.floor(rounded / 60))}:${pad(rounded % 60)}`;
};

const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const schema = yup.object({
  project: yup.string().required("Project is required"),
  title: yup.string().trim().required("Title is required"),
  type: yup.string().oneOf(["task", "bug"]).default("task"),
  isClientChange: yup.boolean().default(false),
  modules: yup
    .array()
    .of(yup.string())
    .when("type", {
      is: "bug",
      then: (s) => s.min(1, "Bugs must be tagged to at least one module"),
    }),
  startTime: yup.string().nullable(),
  endTime: yup
    .string()
    .nullable()
    .test("time-slot", "Both times are required together, end after start", function (value) {
      const { startTime } = this.parent;
      if (!startTime && !value) return true;
      if (!!startTime !== !!value) return false;
      return value > startTime;
    }),
});

export default function TaskDialog({ open, onClose: onCloseProp, projects, directory, task, lockedProjectId, forceType = "task" }) {
  const me = useAuthStore((s) => s.user);
  const isMember = me?.role === "member";
  const isDirector = me?.role === "director";
  const queryClient = useQueryClient();
  const toast = useToast();
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
    control,
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
        project: lockedProjectId || task?.project || "",
        type: task?.type || forceType,
        reference: task?.reference || "",
        modules: task?.modules?.map((m) => m._id || m) || [],
        title: task?.title || "",
        description: task?.description || "",
        assignees: task?.assignees?.map((a) => a._id || a) || [],
        priority: task?.priority || "low",
        estimatedHours: task?.estimatedHours ?? "",
        deadline: task?.deadline ? task.deadline.slice(0, 10) : todayStr(),
        startTime: task?.startTime || nowTimeStr(),
        endTime: task?.endTime || "23:00",
        labels: task?.labels?.join(", ") || "",
        isClientChange: task?.isClientChange || false,
        blockedBy: task?.blockedBy?.map((b) => b._id || b) || [],
        recurrence: task?.recurrence?.frequency || "none",
      });
    }
  }, [open, reset, task, lockedProjectId, forceType]);

  const mutation = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: (values) =>
      createTask({
        ...values,
        type: values.type || "task",
        reference: values.reference || "",
        modules: values.modules || [],
        estimatedHours: values.estimatedHours ? Number(values.estimatedHours) : undefined,
        deadline: values.deadline || null,
        startTime: values.startTime || null,
        endTime: values.endTime || null,
        labels: values.labels
          ? values.labels.split(",").map((l) => l.trim()).filter(Boolean)
          : [],
        recurrence: values.recurrence && values.recurrence !== "none" ? { frequency: values.recurrence, interval: 1 } : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(isMember ? "Task submitted for approval" : "Task created");
      onClose();
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Something went wrong";
      setApiError(message);
      toast.error(message);
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={forceType === "bug" ? "New bug" : "New task"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isSubmitting || mutation.isPending} onClick={handleSubmit((v) => mutation.mutate(v))}>
            {forceType === "bug" ? "Create bug" : "Create task"}
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
          {lockedProjectId ? (
            <div>
              <p className="text-sm font-medium">Project</p>
              <div className="mt-1 flex items-center rounded-input border border-border bg-background/60 px-3 py-2 text-sm text-muted">
                {projects.find((p) => p._id === lockedProjectId)?.name || "This project"}
              </div>
            </div>
          ) : (
            <div>
              <Controller
                name="project"
                control={control}
                defaultValue=""
                render={({ field }) => (
                  <MultiSelect
                    label="Project"
                    multiple={false}
                    items={projects}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select project…"
                  />
                )}
              />
              {errors.project?.message && <p className="mt-1 text-sm text-danger">{errors.project.message}</p>}
            </div>
          )}
          <div>
            <Controller
              name="modules"
              control={control}
              defaultValue={[]}
              render={({ field }) => (
                <MultiSelect
                  label="Modules"
                  items={modules}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="None"
                />
              )}
            />
            {errors.modules?.message && <p className="mt-1 text-sm text-danger">{errors.modules.message}</p>}
          </div>
        </div>
        <Input label="Title" error={errors.title?.message} {...register("title")} />
        <Textarea label="Description" {...register("description")} />
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="accent-primary" {...register("isClientChange")} />
          Client requested this change
        </label>
        {watch("type") === "bug" && (
          <Input label="Reference (optional)" placeholder="Link or note on what this bug came from" {...register("reference")} />
        )}
        {isMember ? (
          <p className="rounded-input border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
            This task will be assigned to you and needs approval from your manager before you can start it.
          </p>
        ) : (
          <>
            <Controller
              name="assignees"
              control={control}
              defaultValue={[]}
              render={({ field }) => (
                <MultiSelect label="Assignees" items={directory} value={field.value} onChange={field.onChange} placeholder="Select assignees…" />
              )}
            />
            {Boolean(projectId) && (
              <Controller
                name="blockedBy"
                control={control}
                defaultValue={[]}
                render={({ field }) => (
                  <MultiSelect
                    label="Blocked by"
                    items={blockableTasks.map((t) => ({ _id: t._id, name: t.title }))}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="None"
                  />
                )}
              />
            )}
          </>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Select label="Priority" {...register("priority")}>
            {["low", "medium", "high"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <Input label="Est. hours" type="number" min="0" step="0.5" {...register("estimatedHours")} />
          <Input label="Deadline" type="date" {...register("deadline")} />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <Controller
              name="startTime"
              control={control}
              defaultValue=""
              render={({ field }) => (
                <ClockPicker label="Start time" value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.startTime?.message && <p className="mt-1 text-sm text-danger">{errors.startTime.message}</p>}
          </div>
          <div>
            <Controller
              name="endTime"
              control={control}
              defaultValue=""
              render={({ field }) => <ClockPicker label="End time" value={field.value} onChange={field.onChange} />}
            />
            {errors.endTime?.message && <p className="mt-1 text-sm text-danger">{errors.endTime.message}</p>}
          </div>
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
