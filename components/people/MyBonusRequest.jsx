"use client";

import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2 } from "lucide-react";

import Skeleton from "@/components/ui/Skeleton";
import { Button, Textarea } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { fetchMyBonusRequest, submitBonusRequest } from "@/services/peopleService";
import { monthLabel } from "@/lib/appraisal";

const fmtDay = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const schema = yup.object({ reason: yup.string().trim().min(20, "Please explain in at least 20 characters").max(5000).required("Please explain") });

// An employee's once-a-month "why I should get a special bonus" — open from
// the 25th to the last day of the month (IST).
export default function MyBonusRequest() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-bonus-request"], queryFn: fetchMyBonusRequest });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema), defaultValues: { reason: "" } });
  const send = useMutation({
    mutationFn: (v) => submitBonusRequest(v.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-bonus-request"] });
      toast.success("Bonus request submitted");
    },
    onError: (e) => toast.error(e.response?.data?.message || "Something went wrong"),
  });

  if (isLoading) return <Skeleton className="h-48 w-full rounded-card" />;
  const { window, request, history } = data;

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">{monthLabel(window.month)}</h2>
        {request ? (
          <div className="mt-3 space-y-2">
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 size={16} /> Submitted on{" "}
              {new Date(request.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
            </p>
            <p className="whitespace-pre-wrap rounded-btn border border-border bg-background p-3 text-sm">{request.reason}</p>
            <p className="text-xs text-muted">One request per month. HR, Admin and Directors can see it.</p>
          </div>
        ) : window.open ? (
          <form className="mt-3 space-y-3" noValidate onSubmit={handleSubmit((v) => send.mutate(v))}>
            <p className="text-sm text-muted">
              Explain why you should receive a special bonus this month. You can submit <strong>once</strong>, until{" "}
              {fmtDay(window.closesOn)} (IST). HR, Admin and Directors will see your name and reason.
            </p>
            <Textarea label="Why I deserve a special bonus" rows={6} error={errors.reason?.message} {...register("reason")} />
            <div className="flex justify-end">
              <Button type="submit" disabled={send.isPending}>
                {send.isPending ? "Submitting…" : "Submit request"}
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <CalendarClock size={16} /> Requests open on {fmtDay(window.opensOn)} and close on {fmtDay(window.closesOn)} (IST).
          </p>
        )}
      </section>
      {history.filter((h) => h.month !== window.month).length > 0 && (
        <section className="rounded-card border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Previous requests</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {history
              .filter((h) => h.month !== window.month)
              .map((h) => (
                <li key={h._id}>
                  <p className="text-xs text-muted">{monthLabel(h.month)}</p>
                  <p className="line-clamp-2">{h.reason}</p>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
