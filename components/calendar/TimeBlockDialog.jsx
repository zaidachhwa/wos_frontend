"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import Dialog from "@/components/ui/Dialog";
import { Input, Textarea, Select, Button } from "@/components/ui/Field";
import { useAuthStore } from "@/store/authStore";
import { createTimeBlock, updateTimeBlock, deleteTimeBlock } from "@/services/timeblockService";

const CATEGORIES = ["meeting", "deep_work", "personal", "followup", "project_work", "break"];

const schema = yup.object({
  title: yup.string().trim().required("Title is required"),
  date: yup.string().required("Date is required"),
  startTime: yup.string().required("Start time is required"),
  endTime: yup
    .string()
    .required("End time is required")
    .test("after", "Must end after start", function (value) {
      return !this.parent.startTime || !value || value > this.parent.startTime;
    }),
});

const toLocalParts = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};

function TimeBlockForm({ onClose, block, defaultDate, directory, projects }) {
  const isEdit = Boolean(block);
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState("");

  const canAssignOthers = ["admin", "manager"].includes(me?.role);
  const start = block ? toLocalParts(block.start) : null;
  const end = block ? toLocalParts(block.end) : null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      title: block?.title || "",
      description: block?.description || "",
      category: block?.category || "deep_work",
      date: start?.date || defaultDate || "",
      startTime: start?.time || "09:00",
      endTime: end?.time || "10:00",
      project: block?.project || "",
      user: block?.user || "",
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["calendar"] });
    queryClient.invalidateQueries({ queryKey: ["timeblocks"] });
  };

  const mutation = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: (values) => {
      const payload = {
        title: values.title,
        description: values.description,
        category: values.category,
        start: new Date(`${values.date}T${values.startTime}`),
        end: new Date(`${values.date}T${values.endTime}`),
        project: values.project || null,
      };
      if (canAssignOthers && values.user) payload.user = values.user;
      return isEdit ? updateTimeBlock({ id: block._id, ...payload }) : createTimeBlock(payload);
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (error) => setApiError(error.response?.data?.message || "Something went wrong"),
  });

  const removal = useMutation({
    mutationFn: () => deleteTimeBlock(block._id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (error) => setApiError(error.response?.data?.message || "Something went wrong"),
  });

  return (
    <form className="space-y-4" noValidate>
      {apiError && (
        <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {apiError}
        </p>
      )}
      <Input label="Title" error={errors.title?.message} {...register("title")} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Input label="Date" type="date" error={errors.date?.message} {...register("date")} />
        <Input label="Start" type="time" error={errors.startTime?.message} {...register("startTime")} />
        <Input label="End" type="time" error={errors.endTime?.message} {...register("endTime")} />
        <Select label="Category" {...register("category")}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Linked project (optional)" {...register("project")}>
          <option value="">None</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </Select>
        {canAssignOthers && !isEdit && (
          <Select label="For" {...register("user")}>
            <option value="">Myself</option>
            {directory
              .filter((d) => d._id !== me?._id)
              .map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
          </Select>
        )}
      </div>
      <Textarea label="Description" {...register("description")} />
      <div className="flex justify-between gap-2 border-t border-border pt-4">
        {isEdit ? (
          <Button variant="danger" type="button" disabled={removal.isPending} onClick={() => removal.mutate()}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || mutation.isPending}
            onClick={handleSubmit((v) => mutation.mutate(v))}
          >
            {isEdit ? "Save changes" : "Create block"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export default function TimeBlockDialog({ open, onClose, block, defaultDate, directory, projects }) {
  return (
    <Dialog open={open} onClose={onClose} title={block ? "Edit time block" : "New time block"}>
      {open && (
        <TimeBlockForm
          onClose={onClose}
          block={block}
          defaultDate={defaultDate}
          directory={directory}
          projects={projects}
        />
      )}
    </Dialog>
  );
}
