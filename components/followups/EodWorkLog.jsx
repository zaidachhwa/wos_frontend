"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Copy, FileText } from "lucide-react";

import Dialog from "@/components/ui/Dialog";
import Skeleton from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Field";
import { fetchWorkLog } from "@/services/followupService";

// Only rendered once today's evening follow-up is submitted — the work log
// is generated from that submission's tomorrow-plan, so it can't exist before then.
export default function EodWorkLog() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const workLog = useMutation({ mutationFn: fetchWorkLog });

  const generate = () => {
    setCopied(false);
    setOpen(true);
    workLog.mutate();
  };

  const copy = async () => {
    await navigator.clipboard.writeText(workLog.data?.text || "");
    setCopied(true);
  };

  return (
    <>
      <Button variant="secondary" onClick={generate}>
        <FileText size={15} /> Generate EOD work log
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="EOD work log"
        footer={
          <Button onClick={copy} disabled={!workLog.data}>
            <Copy size={15} /> {copied ? "Copied!" : "Copy"}
          </Button>
        }
      >
        {workLog.isPending ? (
          <Skeleton className="h-48 w-full rounded-card" />
        ) : workLog.isError ? (
          <p className="text-sm text-danger">
            {workLog.error?.response?.data?.message || "Could not generate the work log. Try again."}
          </p>
        ) : (
          <pre className="whitespace-pre-wrap rounded-input border border-border bg-background/60 p-4 font-sans text-sm">
            {workLog.data?.text}
          </pre>
        )}
      </Dialog>
    </>
  );
}
