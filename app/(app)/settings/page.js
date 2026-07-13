"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation } from "@tanstack/react-query";

import { Input, Button } from "@/components/ui/Field";
import CalendarSyncCard from "@/components/settings/CalendarSyncCard";
import { useAuthStore } from "@/store/authStore";
import { updateProfile, changePassword } from "@/services/profileService";

const profileSchema = yup.object({
  name: yup.string().trim().required("Name is required"),
});

const passwordSchema = yup.object({
  currentPassword: yup.string().required("Current password is required"),
  newPassword: yup.string().min(8, "At least 8 characters").required("New password is required"),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("newPassword")], "Passwords must match")
    .required("Confirm the new password"),
});

function Feedback({ state }) {
  if (!state) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded-input border px-3 py-2 text-sm ${
        state.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"
      }`}
    >
      {state.message}
    </p>
  );
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [profileState, setProfileState] = useState(null);
  const [passwordState, setPasswordState] = useState(null);

  const profileForm = useForm({
    resolver: yupResolver(profileSchema),
    values: { name: user?.name || "", designation: user?.designation || "" },
  });

  const passwordForm = useForm({ resolver: yupResolver(passwordSchema) });

  const profileMutation = useMutation({
    onMutate: () => setProfileState(null),
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      setUser(updated);
      setProfileState({ ok: true, message: "Profile updated." });
    },
    onError: (e) => setProfileState({ ok: false, message: e.response?.data?.message || "Something went wrong" }),
  });

  const passwordMutation = useMutation({
    onMutate: () => setPasswordState(null),
    mutationFn: ({ currentPassword, newPassword }) => changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      passwordForm.reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordState({ ok: true, message: "Password updated." });
    },
    onError: (e) => setPasswordState({ ok: false, message: e.response?.data?.message || "Something went wrong" }),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="rounded-card border border-border bg-surface p-6">
        <h3 className="text-base font-semibold tracking-tight">Profile</h3>
        <form
          className="mt-4 space-y-4"
          noValidate
          onSubmit={profileForm.handleSubmit((v) => profileMutation.mutate(v))}
        >
          <Feedback state={profileState} />
          <Input
            label="Name"
            error={profileForm.formState.errors.name?.message}
            {...profileForm.register("name")}
          />
          <Input label="Designation" {...profileForm.register("designation")} />
          <div className="grid grid-cols-1 gap-4 text-sm text-muted sm:grid-cols-2">
            <p>
              Email — <span className="text-primary">{user?.email}</span>
            </p>
            <p>
              Role — <span className="capitalize text-primary">{user?.role}</span>
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={profileMutation.isPending}>
              Save profile
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-card border border-border bg-surface p-6">
        <h3 className="text-base font-semibold tracking-tight">Change password</h3>
        <form
          className="mt-4 space-y-4"
          noValidate
          onSubmit={passwordForm.handleSubmit((v) => passwordMutation.mutate(v))}
        >
          <Feedback state={passwordState} />
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            error={passwordForm.formState.errors.currentPassword?.message}
            {...passwordForm.register("currentPassword")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              error={passwordForm.formState.errors.newPassword?.message}
              {...passwordForm.register("newPassword")}
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              error={passwordForm.formState.errors.confirmPassword?.message}
              {...passwordForm.register("confirmPassword")}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={passwordMutation.isPending}>
              Update password
            </Button>
          </div>
        </form>
      </section>

      <CalendarSyncCard />
    </div>
  );
}
