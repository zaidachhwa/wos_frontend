"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Copy, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/Field";
import { getIcsToken, regenerateIcsToken } from "@/services/profileService";

const feedUrl = (token) =>
  `${process.env.NEXT_PUBLIC_API_URL}/calendar/ics/${token}`;

export default function CalendarSyncCard() {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: token } = useQuery({ queryKey: ["ics-token"], queryFn: getIcsToken });

  const regenerate = useMutation({
    mutationFn: regenerateIcsToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ics-token"] }),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl(token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — the URL is visible to copy manually
    }
  };

  return (
    <section className="rounded-card border border-border bg-surface p-6">
      <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight">
        <CalendarPlus size={18} className="text-muted" /> Google Calendar sync
      </h3>
      <p className="mt-2 text-sm text-muted">
        Subscribe to your WorkOS schedule (time blocks, task & project deadlines, follow-ups) from
        Google Calendar: <span className="font-medium text-primary">Other calendars → + → From URL</span>,
        then paste your private feed link. Google refreshes it every few hours. Anyone with the link
        can read your schedule — regenerate it if it ever leaks.
      </p>

      {token ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-input border border-border bg-background/60 px-3 py-2 text-xs">
              {feedUrl(token)}
            </code>
            <Button variant="secondary" onClick={copy}>
              <Copy size={14} /> {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <Button variant="ghost" disabled={regenerate.isPending} onClick={() => regenerate.mutate()}>
            <RefreshCw size={14} /> Regenerate link (invalidates the old one)
          </Button>
        </div>
      ) : (
        <div className="mt-4">
          <Button disabled={regenerate.isPending} onClick={() => regenerate.mutate()}>
            <CalendarPlus size={15} /> Generate my feed link
          </Button>
        </div>
      )}
    </section>
  );
}
