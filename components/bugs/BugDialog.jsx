"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Dialog from "@/components/ui/Dialog";
import { Button, Input, Select, Textarea } from "@/components/ui/Field";
import BugComments from "@/components/bugs/BugComments";
import useToast from "@/hooks/useToast";
import { createBug, fetchReportableEmployees, updateBug } from "@/services/bugService";
import { fetchProjects } from "@/services/projectService";
import { apiError as errorMessage } from "@/lib/appraisal";

const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10); // IST calendar day

const schema = yup.object({
  employee: yup.string().required("Select the employee"),
  title: yup.string().trim().required("Title is required").max(300),
  description: yup.string().max(5000),
  severity: yup.string().required("Select a severity"),
  date: yup.string().required("Date is required"),
  project: yup.string(),
  status: yup.string(),
  includeInAppraisal: yup.boolean(),
  exclusionReason: yup.string().when("includeInAppraisal", {
    is: false,
    then: (s) => s.trim().required("Give a reason for excluding this bug"),
  }),
  resolution: yup.string(),
});

// Create/edit a bug report. HR sees the review fields (status, include in
// appraisal, resolution); a lead can edit their own report until HR reviews it.
export default function BugDialog({ open, onClose: onCloseProp, bug, severities, isHr, canEdit }) {
  const isEdit = Boolean(bug);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState("");
  const onClose = () => {
    setApiError("");
    onCloseProp();
  };
  const { data: employees = [] } = useQuery({ queryKey: ["bug-employees"], queryFn: fetchReportableEmployees, enabled: open && !isEdit });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects, enabled: open });

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
      employee: bug?.employee?._id || "",
      title: bug?.title || "",
      description: bug?.description || "",
      severity: bug?.severity || "",
      date: bug?.date || today(),
      project: bug?.project?._id || "",
      status: bug?.status || "reported",
      includeInAppraisal: bug?.includeInAppraisal ?? true,
      exclusionReason: bug?.exclusionReason || "",
      resolution: bug?.resolution || "",
    });
  }, [open, bug, reset]);

  const save = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: (v) => {
      const base = { title: v.title, description: v.description, severity: v.severity, date: v.date, project: v.project || null };
      if (!isEdit) return createBug({ ...base, employee: v.employee });
      const review = isHr ? { status: v.status, includeInAppraisal: v.includeInAppraisal, exclusionReason: v.exclusionReason, resolution: v.resolution } : {};
      return updateBug({ id: bug._id, ...base, ...review });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["bugs"] });
      queryClient.invalidateQueries({ queryKey: ["appraisals"] });
      if (res.data?.notice) toast.info(res.data.notice);
      else toast.success(isEdit ? "Bug updated" : "Bug reported");
      onClose();
    },
    onError: (e) => {
      setApiError(errorMessage(e));
      toast.error(errorMessage(e));
    },
  });

  const readOnly = isEdit && !canEdit;
  const include = useWatch({ control, name: "includeInAppraisal" });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? bug.title : "Report a bug"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button disabled={save.isPending} onClick={handleSubmit((v) => save.mutate(v))}>
              {isEdit ? "Save changes" : "Report bug"}
            </Button>
          )}
        </>
      }
    >
      <form className="space-y-4" noValidate>
        {apiError && (
          <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {apiError}
          </p>
        )}
        {isEdit ? (
          <p className="text-sm">
            <span className="text-muted">Employee:</span> {bug.employee?.name} · <span className="text-muted">Reported by</span> {bug.reportedBy?.name} ({bug.reporterRole})
          </p>
        ) : (
          <Select label="Employee" error={errors.employee?.message} {...register("employee")}>
            <option value="">Select…</option>
            {employees.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
                {u.department?.name ? ` — ${u.department.name}` : ""}
              </option>
            ))}
          </Select>
        )}
        <fieldset disabled={readOnly} className="space-y-4">
          <Input label="Bug title" error={errors.title?.message} {...register("title")} />
          <Textarea label="Description" rows={3} {...register("description")} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select label="Severity" error={errors.severity?.message} {...register("severity")}>
              <option value="">Select…</option>
              {severities
                .filter((s) => s.isActive !== false || s.key === bug?.severity)
                .map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label} (−{s.penalty})
                  </option>
                ))}
            </Select>
            <Input label="Date" type="date" max={today()} error={errors.date?.message} {...register("date")} />
            <Select label="Project" {...register("project")}>
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          {isEdit && isHr && (
            <div className="space-y-4 rounded-btn border border-border bg-background p-4">
              <p className="text-sm font-semibold">HR review</p>
              <Select label="Status" {...register("status")}>
                <option value="reported">Reported (awaiting review)</option>
                <option value="confirmed">Confirmed</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("includeInAppraisal")} /> Include in appraisal
              </label>
              {!include && <Input label="Reason for excluding" error={errors.exclusionReason?.message} {...register("exclusionReason")} />}
              <Textarea label="Resolution" rows={2} {...register("resolution")} />
            </div>
          )}
        </fieldset>
      </form>
      {isEdit && <BugComments key={bug._id} bug={bug} />}
    </Dialog>
  );
}
