"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import Dialog from "@/components/ui/Dialog";
import { Input, Select, Button } from "@/components/ui/Field";
import MultiSelect from "@/components/ui/MultiSelect";
import { createUser, updateUser } from "@/services/orgService";

// Mirrors MANAGEABLE_ROLES in wos_backend/src/controllers/userController.js
// — which target roles each scoped (non-admin) actor may create/edit.
const MANAGEABLE_ROLES = {
  subadmin: ["manager", "sublead", "member"],
  manager: ["member"],
  sublead: ["member"],
};

const ROLE_LABELS = { member: "Member", sublead: "Sub Lead", manager: "Manager", subadmin: "Sub Admin", admin: "Admin" };

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
    is: "subadmin",
    then: (s) => s.required("Managed department is required for this role"),
    otherwise: (s) => s.strip(),
  }),
  managedTeam: yup.string().when("role", {
    is: "manager",
    then: (s) => s.required("Managed team is required for this role"),
    otherwise: (s) => s.strip(),
  }),
});

export default function UserDialog({ open, onClose: onCloseProp, user, directory, departments, teams, actor }) {
  const isEdit = Boolean(user);
  const isAdminActor = actor?.role === "admin";
  const isSubadminActor = actor?.role === "subadmin";
  const selectableRoles = isAdminActor
    ? ["member", "sublead", "manager", "subadmin", "admin"]
    : MANAGEABLE_ROLES[actor?.role] || [];
  const managedDepartmentId = actor?.managedDepartment?._id || actor?.managedDepartment;
  const actorManagedTeamIds =
    actor?.role === "manager"
      ? [actor?.managedTeam?._id || actor?.managedTeam].filter(Boolean)
      : actor?.role === "sublead"
        ? (actor?.managedTeams || []).map((t) => t._id || t)
        : null;
  const visibleTeams = isSubadminActor
    ? managedDepartmentId
      ? teams.filter((t) => String(t.department?._id || t.department) === String(managedDepartmentId))
      : []
    : actorManagedTeamIds
      ? teams.filter((t) => actorManagedTeamIds.map(String).includes(String(t._id)))
      : teams;
  const teamPickerItems = teams.map((t) => ({ _id: t._id, name: t.department?.name ? `${t.name} — ${t.department.name}` : t.name }));
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
    control,
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
        managedTeam: user?.managedTeam?._id || user?.managedTeam || "",
        managedTeams: user?.managedTeams?.map((t) => t._id || t) || [],
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
        // Sub-admin's scope is the whole managedDepartment automatically —
        // a personal team is irrelevant to what they can see/manage, so
        // it's not even offered as a field for that role (below).
        team: values.role === "subadmin" ? null : values.team || null,
        reportingManager: values.reportingManager || null,
        managedDepartment: values.role === "subadmin" ? values.managedDepartment || null : null,
        managedTeam: values.role === "manager" ? values.managedTeam || null : null,
        managedTeams: values.role === "sublead" ? values.managedTeams || [] : [],
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
          {selectableRoles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        <Input label="Designation" {...register("designation")} />
        {isAdminActor && (
          <Select label="Department" {...register("department")}>
            <option value="">None</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </Select>
        )}
        {selectedRole === "subadmin" && (
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
        {selectedRole === "manager" && (
          <div className="animate-[fadeIn_150ms_ease-out]">
            <Select label="Managed team" error={errors.managedTeam?.message} {...register("managedTeam")}>
              <option value="">Select team…</option>
              {teamPickerItems.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {selectedRole === "sublead" && (
          <div className="animate-[fadeIn_150ms_ease-out]">
            <Controller
              name="managedTeams"
              control={control}
              defaultValue={[]}
              render={({ field }) => (
                <MultiSelect
                  label="Managed teams"
                  items={isAdminActor ? teamPickerItems : visibleTeams}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="None yet"
                />
              )}
            />
          </div>
        )}
        {selectedRole !== "subadmin" && (
          <Select label="Team" {...register("team")}>
            <option value="">None</option>
            {visibleTeams.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
        {isAdminActor && (
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
