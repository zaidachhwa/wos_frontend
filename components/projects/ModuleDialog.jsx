"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import Dialog from "@/components/ui/Dialog";
import { Input, Textarea, Select, Button } from "@/components/ui/Field";
import { createModule, updateModule } from "@/services/projectService";

const schema = yup.object({
  name: yup.string().trim().required("Name is required"),
});

export default function ModuleDialog({ open, onClose: onCloseProp, projectId, module, directory }) {
  const isEdit = Boolean(module);
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
    formState: { errors, isSubmitting },
  } = useForm({ resolver: yupResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({
        name: module?.name || "",
        description: module?.description || "",
        assignees: (module?.assignees || []).map((a) => a._id || a),
        status: module?.status || "planning",
        deadline: module?.deadline ? module.deadline.slice(0, 10) : "",
      });
    }
  }, [open, module, reset]);

  const mutation = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: (values) => {
      const payload = { ...values, deadline: values.deadline || null };
      return isEdit
        ? updateModule({ projectId, moduleId: module._id, ...payload })
        : createModule({ projectId, ...payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      onClose();
    },
    onError: (error) => setApiError(error.response?.data?.message || "Something went wrong"),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${module?.name}` : "New module"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isSubmitting || mutation.isPending} onClick={handleSubmit((v) => mutation.mutate(v))}>
            {isEdit ? "Save changes" : "Create module"}
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
        <Input label="Name" error={errors.name?.message} {...register("name")} />
        <Textarea label="Description" {...register("description")} />
        <Select label="Assignees" multiple size={Math.min(4, directory.length || 1)} {...register("assignees")}>
          {directory.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isEdit && (
            <Select label="Status" {...register("status")}>
              {["planning", "active", "on_hold", "completed", "cancelled"].map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </Select>
          )}
          <Input label="Deadline" type="date" {...register("deadline")} />
        </div>
      </form>
    </Dialog>
  );
}
