"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import Dialog from "@/components/ui/Dialog";
import { Input, Textarea, Select, Button } from "@/components/ui/Field";
import { createProject, updateProject } from "@/services/projectService";
import useToast from "@/hooks/useToast";

const schema = yup.object({
  name: yup.string().trim().required("Name is required"),
  manager: yup.string().required("Manager is required"),
});

// Form state lives in a component that mounts fresh on every dialog open,
// so no reset-in-effect is needed.
function ProjectForm({ onClose, project, directory }) {
  const isEdit = Boolean(project);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [apiError, setApiError] = useState("");
  const [memberIds, setMemberIds] = useState(() => (project?.members || []).map((m) => m._id || m));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      name: project?.name || "",
      description: project?.description || "",
      manager: project?.manager?._id || "",
      priority: project?.priority || "medium",
      status: project?.status || "planning",
      startDate: project?.startDate ? project.startDate.slice(0, 10) : "",
      deadline: project?.deadline ? project.deadline.slice(0, 10) : "",
    },
  });

  const mutation = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: (values) => {
      const payload = {
        ...values,
        members: memberIds,
        startDate: values.startDate || null,
        deadline: values.deadline || null,
      };
      return isEdit ? updateProject({ id: project._id, ...payload }) : createProject(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["project", project._id] });
      toast.success(isEdit ? "Project updated" : "Project created");
      onClose();
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Something went wrong";
      setApiError(message);
      toast.error(message);
    },
  });

  const toggleMember = (id) =>
    setMemberIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const managerOptions = directory.filter((d) => ["admin", "manager"].includes(d.role));

  return (
    <form className="space-y-4" noValidate>
      {apiError && (
        <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {apiError}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Name" error={errors.name?.message} {...register("name")} />
        <Select label="Manager" error={errors.manager?.message} {...register("manager")}>
          <option value="">Select manager…</option>
          {managerOptions.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name}
            </option>
          ))}
        </Select>
      </div>
      <Textarea label="Description" {...register("description")} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Select label="Priority" {...register("priority")}>
          {["low", "medium", "high", "critical"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        {isEdit && (
          <Select label="Status" {...register("status")}>
            {["planning", "active", "on_hold", "completed", "cancelled"].map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </Select>
        )}
        <Input label="Start date" type="date" {...register("startDate")} />
        <Input label="Deadline" type="date" {...register("deadline")} />
      </div>
      <div>
        <p className="text-sm font-medium">Members</p>
        <div className="mt-2 grid max-h-44 grid-cols-1 gap-1 overflow-y-auto rounded-input border border-border p-2 sm:grid-cols-2">
          {directory.map((d) => (
            <label
              key={d._id}
              className="flex cursor-pointer items-center gap-2 rounded-btn px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-background"
            >
              <input
                type="checkbox"
                checked={memberIds.includes(d._id)}
                onChange={() => toggleMember(d._id)}
                className="accent-primary"
              />
              <span className="truncate">{d.name}</span>
              <span className="ml-auto text-xs capitalize text-muted">{d.role}</span>
            </label>
          ))}
          {!directory.length && <p className="px-2 py-1.5 text-sm text-muted">No people yet.</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={isSubmitting || mutation.isPending}
          onClick={handleSubmit((v) => mutation.mutate(v))}
        >
          {isEdit ? "Save changes" : "Create project"}
        </Button>
      </div>
    </form>
  );
}

export default function ProjectDialog({ open, onClose, project, directory }) {
  return (
    <Dialog open={open} onClose={onClose} title={project ? `Edit ${project.name}` : "Create project"}>
      {open && <ProjectForm onClose={onClose} project={project} directory={directory} />}
    </Dialog>
  );
}
