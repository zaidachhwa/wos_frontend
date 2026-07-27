"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import { useAuthStore } from "@/store/authStore";
import { login, loginWithGoogle } from "@/services/authService";
import { Input, Button } from "@/components/ui/Field";

const schema = yup.object({
  email: yup.string().email("Enter a valid email").required("Email is required"),
  password: yup.string().required("Password is required"),
});

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [apiError, setApiError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: yupResolver(schema) });

  const onSubmit = async (values) => {
    setApiError("");
    try {
      const data = await login(values);
      setAuth(data);
      router.replace("/dashboard");
    } catch (error) {
      setApiError(error.response?.data?.message || "Something went wrong. Please try again.");
    }
  };

  const handleGoogleCredential = useCallback(
    async ({ credential }) => {
      setApiError("");
      try {
        const data = await loginWithGoogle(credential);
        setAuth(data);
        router.replace("/dashboard");
      } catch (error) {
        setApiError(error.response?.data?.message || "Something went wrong. Please try again.");
      }
    },
    [router, setAuth]
  );

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return undefined;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      window.google.accounts.id.initialize({ client_id: clientId, callback: handleGoogleCredential });
      const target = document.getElementById("google-signin-button");
      if (target) window.google.accounts.id.renderButton(target, { theme: "outline", size: "large", width: 320 });
    };
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, [handleGoogleCredential]);

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      <div className="login-brand-panel flex flex-col items-center justify-center gap-3 py-8 md:min-h-screen md:w-1/2 md:gap-4 md:py-0">
        <Image
          src="/logo.png"
          alt=""
          width={84}
          height={84}
          priority
          className="theme-dark-only h-10 w-10 md:h-20 md:w-20"
        />
        <Image
          src="/logo-light.png"
          alt=""
          width={84}
          height={84}
          priority
          className="theme-dark-hidden h-10 w-10 md:h-20 md:w-20"
        />
        <span className="login-wordmark text-base font-semibold tracking-tight md:text-lg">
          WorkOS
        </span>
        <span className="hidden text-xs text-muted md:block">Team &amp; project management</span>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Sign in to your workspace</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
            {apiError && (
              <p
                role="alert"
                className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
              >
                {apiError}
              </p>
            )}

            <Input
              label="Email"
              id="email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />

            <Input
              label="Password"
              id="password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
              <div id="google-signin-button" className="flex justify-center" />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
