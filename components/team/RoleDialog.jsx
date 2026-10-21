"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import Dialog from "@/components/ui/Dialog";
import { Input, Select, Button } from "@/components/ui/Field";
import { createRole, updateRole } from "@/services/orgService";

const ROLE_OPTIONS = [
  { value: "member", label: "Member (Standard Employee access)" },
  { value: "manager", label: "Manager (Team oversight & approvals)" },
  { value: "sublead", label: "Sub Lead (Leads one or more teams)" },
  { value: "subadmin", label: "Sub Admin (Department management)" },
  { value: "qa", label: "QA (Quality testing & bug verification)" },
  { value: "hr", label: "HR (People, appraisals & attendance)" },
  { value: "director", label: "Director (Executive reports & analytics)" },
  { value: "technical_coordinator", label: "Technical Coordinator (Department availability & free-up alerts)" },
  { value: "admin", label: "Admin (Full system access)" },
];

const schema = yup.object({
  name: yup.string().trim().required("Role name is required"),
  description: yup.string().trim(),
  department: yup.string().nullable(),
  baseRole: yup.string().required("Base permission tier is required"),
  isActive: yup.string().required(),
});

export default function RoleDialog({ open, onClose: onCloseProp, role, departments = [] }) {
  const isEdit = Boolean(role);
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
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      department: "",
      baseRole: "member",
      isActive: "true",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: role?.name || "",
        description: role?.description || "",
        department: role?.department?._id || role?.department || "",
        baseRole: role?.baseRole || "member",
        isActive: role ? String(role.isActive) : "true",
      });
    }
  }, [open, role, reset]);

  const mutation = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: (values) => {
      const payload = {
        name: values.name.trim(),
        description: values.description ? values.description.trim() : "",
        department: values.department || null,
        baseRole: values.baseRole,
        isActive: values.isActive === "true",
      };

      if (isEdit) {
        return updateRole({ id: role._id, ...payload });
      }
      return createRole(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["appraisal-positions"] });
      onClose();
    },
    onError: (err) => {
      setApiError(err.response?.data?.message || "Failed to save role");
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Role: ${role?.name}` : "Create New Role"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={isSubmitting || mutation.isPending}
            onClick={handleSubmit((v) => mutation.mutate(v))}
          >
            {isEdit ? "Save Changes" : "Create Role"}
          </Button>
        </>
      }
    >
      <form className="space-y-4" noValidate onSubmit={(e) => e.preventDefault()}>
        {apiError && (
          <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {apiError}
          </p>
        )}

        <Input
          label="Role Title / Name"
          placeholder="e.g. Lead Frontend Engineer, QA Specialist"
          error={errors.name?.message}
          {...register("name")}
        />

        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            rows={3}
            placeholder="Key responsibilities and scope of this role..."
            className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary resize-none"
            {...register("description")}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Department Scope" error={errors.department?.message} {...register("department")}>
            <option value="">Org-wide (All Departments)</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </Select>

          <Select
            label="Base Permission Level"
            error={errors.baseRole?.message}
            {...register("baseRole")}
            title="Determines default system access and capabilities for users assigned this role"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <Select label="Status" error={errors.isActive?.message} {...register("isActive")}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>

        <p className="text-xs text-muted">
          💡 Roles defined here can be assigned to team members, used in performance appraisal criteria, and filtered in organization reports.
        </p>
      </form>
    </Dialog>
  );
}
