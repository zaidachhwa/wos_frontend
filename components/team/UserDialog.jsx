"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import Dialog from "@/components/ui/Dialog";
import { Input, Select, Button } from "@/components/ui/Field";
import { createUser, updateUser } from "@/services/orgService";

const schema = yup.object({
  name: yup.string().trim().required("Name is required"),
  email: yup.string().email("Enter a valid email").required("Email is required"),
  password: yup.string().when("$isEdit", {
    is: false,
    then: (s) => s.min(8, "At least 8 characters").required("Password is required"),
    otherwise: (s) => s.strip(),
  }),
  role: yup.string().oneOf(["admin", "manager", "subadmin", "sublead", "member"]).required(),
  managedDepartment: yup.string().when("role", {
    is: (role) => role === "subadmin" || role === "manager",
    then: (s) => s.required("Managed department is required for this role"),
    otherwise: (s) => s.strip(),
  }),
});

export default function UserDialog({ open, onClose: onCloseProp, user, directory, departments, teams, actor }) {
  const isEdit = Boolean(user);
  const isSubadminActor = actor?.role === "subadmin";
  const managedDepartmentId = actor?.managedDepartment?._id || actor?.managedDepartment;
  const visibleTeams = isSubadminActor
    ? managedDepartmentId
      ? teams.filter((t) => String(t.department?._id || t.department) === String(managedDepartmentId))
      : []
    : teams;
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
  } = useForm({ resolver: yupResolver(schema), context: { isEdit } });

  const selectedRole = watch("role");

  useEffect(() => {
    if (open) {
      reset({
        name: user?.name || "",
        email: user?.email || "",
        password: "",
        role: user?.role || "member",
        managedDepartment: user?.managedDepartment?._id || "",
        designation: user?.designation || "",
        department: user?.department?._id || "",
        team: user?.team?._id || "",
        reportingManager: user?.reportingManager?._id || "",
        isActive: user ? String(user.isActive) : "true",
      });
    }
  }, [open, user, reset]);

  const mutation = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: (values) => {
      const payload = {
        ...values,
        department: values.department || null,
        team: values.team || null,
        reportingManager: values.reportingManager || null,
        managedDepartment:
          values.role === "subadmin" || values.role === "manager" ? values.managedDepartment || null : null,
        isActive: values.isActive === "true",
      };
      if (isEdit) {
        const { email, password, ...rest } = payload;
        return updateUser({ id: user._id, ...rest });
      }
      return createUser(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["directory"] });
      onClose();
    },
    onError: (error) => setApiError(error.response?.data?.message || "Something went wrong"),
  });

  const managers = directory.filter((d) => ["admin", "manager", "sublead"].includes(d.role));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${user?.name}` : "Create user"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isSubmitting || mutation.isPending} onClick={handleSubmit((v) => mutation.mutate(v))}>
            {isEdit ? "Save changes" : "Create user"}
          </Button>
        </>
      }
    >
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        {apiError && (
          <p role="alert" className="sm:col-span-2 rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {apiError}
          </p>
        )}
        <Input label="Name" error={errors.name?.message} {...register("name")} />
        <Input label="Email" type="email" disabled={isEdit} error={errors.email?.message} {...register("email")} />
        {!isEdit && (
          <Input label="Password" type="password" error={errors.password?.message} {...register("password")} />
        )}
        <Select label="Role" error={errors.role?.message} {...register("role")}>
          <option value="member">Member</option>
          <option value="sublead">Sub Lead</option>
          {!isSubadminActor && (
            <>
              <option value="manager">Manager</option>
              <option value="subadmin">Sub Admin</option>
              <option value="admin">Admin</option>
            </>
          )}
        </Select>
        <Input label="Designation" {...register("designation")} />
        {!isSubadminActor && (
          <Select label="Department" {...register("department")}>
            <option value="">None</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </Select>
        )}
        {(selectedRole === "subadmin" || selectedRole === "manager") && (
          <div className="animate-[fadeIn_150ms_ease-out]">
            <Select
              label="Managed department"
              error={errors.managedDepartment?.message}
              {...register("managedDepartment")}
            >
              <option value="">Select department…</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <Select label="Team" {...register("team")}>
          <option value="">None</option>
          {visibleTeams.map((t) => (
            <option key={t._id} value={t._id}>
              {t.name}
            </option>
          ))}
        </Select>
        {!isSubadminActor && (
          <Select label="Reporting manager" {...register("reportingManager")}>
            <option value="">None</option>
            {managers
              .filter((m) => m._id !== user?._id)
              .map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name} ({m.role})
                </option>
              ))}
          </Select>
        )}
        {isEdit && (
          <Select label="Status" {...register("isActive")}>
            <option value="true">Active</option>
            <option value="false">Deactivated</option>
          </Select>
        )}
      </form>
    </Dialog>
  );
}
