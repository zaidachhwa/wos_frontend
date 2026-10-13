"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Dialog from "@/components/ui/Dialog";
import MultiSelect from "@/components/ui/MultiSelect";
import { Button, Input, Textarea } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { fetchDirectory } from "@/services/orgService";
import { createGeneralTask, updateGeneralTask } from "@/services/generalTaskService";
import { istInputToIso, isoToIstInput } from "@/components/general/generalTaskUtils";

const schema = yup.object({
  title: yup.string().trim().required("Task name is required").max(200),
  description: yup.string().max(5000),
  dueAt: yup.string().required("Choose the due date and time"),
  assignees: yup.array().min(1, "Choose at least one assignee"),
});

// Director creates/edits a General task: name, description, due date+time
// (IST) and one or more assignees from any employee.
export default function GeneralTaskDialog({ open, onClose: onCloseProp, task }) {
  const isEdit = Boolean(task);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState("");
  const onClose = () => {
    setApiError("");
    onCloseProp();
  };
  const { data: directory = [] } = useQuery({ queryKey: ["directory"], queryFn: fetchDirectory, enabled: open });
  const people = directory.map((u) => ({ _id: u._id, name: `${u.name}${u.designation ? ` — ${u.designation}` : ""}` }));

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      title: task?.title || "",
      description: task?.description || "",
      dueAt: isoToIstInput(task?.dueAt),
      assignees: (task?.assignments || []).map((a) => String(a.user?._id || a.user)),
    });
  }, [open, task, reset]);

  const save = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: (v) => {
      const payload = { title: v.title, description: v.description, dueAt: istInputToIso(v.dueAt), assignees: v.assignees };
      return isEdit ? updateGeneralTask({ id: task._id, ...payload }) : createGeneralTask(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-tasks"] });
      toast.success(isEdit ? "Task updated" : "Task assigned");
      onClose();
    },
    onError: (e) => {
      const message = e.response?.data?.message || "Something went wrong";
      setApiError(message);
      toast.error(message);
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit task" : "New general task"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={handleSubmit((v) => save.mutate(v))}>
            {isEdit ? "Save changes" : "Assign task"}
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
        <Input label="Task name" error={errors.title?.message} {...register("title")} />
        <Textarea label="Description" rows={3} error={errors.description?.message} {...register("description")} />
        <Input label="Due date & time (IST)" type="datetime-local" error={errors.dueAt?.message} {...register("dueAt")} />
        <div>
          <Controller
            name="assignees"
            control={control}
            render={({ field }) => (
              <MultiSelect label="Assignees" items={people} value={field.value || []} onChange={field.onChange} placeholder="Select one or more people…" />
            )}
          />
          {errors.assignees && <p className="mt-1 text-sm text-danger">{errors.assignees.message}</p>}
        </div>
        {isEdit && (
          <p className="text-xs text-muted">People you keep on the task keep their progress. Anyone you add starts as not done and is notified.</p>
        )}
      </form>
    </Dialog>
  );
}
