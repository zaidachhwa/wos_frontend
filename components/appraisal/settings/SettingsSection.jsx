"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { updateAppraisalSettings } from "@/services/appraisalsService";
import { apiError } from "@/lib/appraisal";

// Shared shell for the settings cards: holds a local draft of one slice of
// AppraisalSettings, saves it through PATCH /appraisals/settings (which
// validates and versions it), and shows the server's error inline.
export default function SettingsSection({ title, description, initial, toPayload, children }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const value = draft ?? initial;

  const save = useMutation({
    onMutate: () => setError(""),
    mutationFn: () => updateAppraisalSettings(toPayload(value)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appraisal-settings"] });
      queryClient.invalidateQueries({ queryKey: ["appraisals"] });
      setDraft(null);
      toast.success(`${title} saved`);
    },
    onError: (e) => setError(apiError(e)),
  });

  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {error && (
        <p role="alert" className="mt-3 rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-4">{children(value, setDraft)}</div>
      <div className="mt-4 flex justify-end gap-2">
        {draft && (
          <Button variant="secondary" onClick={() => setDraft(null)}>
            Discard
          </Button>
        )}
        <Button disabled={!draft || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </section>
  );
}
