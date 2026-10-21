"use client";

import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation } from "@tanstack/react-query";
import { EyeOff } from "lucide-react";

import { Button, Select, Textarea } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { submitAnonymousFeedback } from "@/services/peopleService";

export const CATEGORY_LABELS = {
  general: "General",
  workplace: "Workplace & culture",
  management: "Management",
  process: "Process & tools",
  suggestion: "Suggestion",
  other: "Other",
};

const schema = yup.object({
  category: yup.string().required(),
  message: yup.string().trim().min(5, "Please write at least a few words").max(5000).required("Please write your feedback"),
});

export default function AnonymousFeedbackForm() {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema), defaultValues: { category: "general", message: "" } });
  const send = useMutation({
    mutationFn: submitAnonymousFeedback,
    onSuccess: () => {
      reset({ category: "general", message: "" });
      toast.success("Feedback sent anonymously");
    },
    onError: (e) => toast.error(e.response?.data?.message || "Something went wrong"),
  });

  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-start gap-3 rounded-btn border border-info/30 bg-info/5 p-3 text-sm">
        <EyeOff size={18} className="mt-0.5 shrink-0 text-info" />
        <p>
          <span className="font-semibold">Completely anonymous.</span> WOS does not store your name, account, email, device or the time you
          sent it — only your message, the category and the date. HR and Admin can read it but cannot see who wrote it. Avoid details that
          would identify you if you want to stay anonymous.
        </p>
      </div>
      <form className="mt-4 space-y-4" noValidate onSubmit={handleSubmit((v) => send.mutate(v))}>
        <div className="max-w-xs">
          <Select label="Category" {...register("category")}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <Textarea label="Your feedback" rows={6} error={errors.message?.message} {...register("message")} />
        <div className="flex justify-end">
          <Button type="submit" disabled={send.isPending}>
            {send.isPending ? "Sending…" : "Send anonymously"}
          </Button>
        </div>
      </form>
    </section>
  );
}
