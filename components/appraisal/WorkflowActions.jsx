"use client";

import { useState } from "react";
import { History, Lock, RefreshCw, RotateCcw, Send } from "lucide-react";

import Dialog from "@/components/ui/Dialog";
import { Button, Textarea } from "@/components/ui/Field";
import AuditTrailDialog from "@/components/appraisal/AuditTrailDialog";

// Recalculate / submit / finalize / reopen. The backend enforces every rule
// (month ended, inputs complete, weightage = 100%, reason for reopen); the
// buttons only reflect the current status.
export default function WorkflowActions({ appraisal, monthEnded, busy, onAction }) {
  const [reopenOpen, setReopenOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [reason, setReason] = useState("");
  const finalized = appraisal.status === "finalized";
  const complete = !appraisal.missingInputs?.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!finalized && (
        <Button variant="ghost" disabled={busy} onClick={() => onAction("recalculate")}>
          <RefreshCw size={15} /> Recalculate
        </Button>
      )}
      {!finalized && appraisal.status !== "submitted" && appraisal.status !== "reopened" && (
        <Button variant="secondary" disabled={busy || !complete} title={complete ? "" : "Complete all inputs first"} onClick={() => onAction("submit")}>
          <Send size={15} /> Submit for finalization
        </Button>
      )}
      {!finalized && (
        <Button
          disabled={busy || !complete || !monthEnded}
          title={!monthEnded ? "Available after the month ends (IST)" : complete ? "" : "Complete all inputs first"}
          onClick={() => onAction("finalize")}
        >
          <Lock size={15} /> Finalize
        </Button>
      )}
      {finalized && (
        <Button variant="secondary" disabled={busy} onClick={() => setReopenOpen(true)}>
          <RotateCcw size={15} /> Reopen
        </Button>
      )}
      <Button variant="ghost" onClick={() => setAuditOpen(true)}>
        <History size={15} /> Audit trail
      </Button>

      <Dialog
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        title="Reopen finalized appraisal"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReopenOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy || reason.trim().length < 10}
              onClick={() => onAction("reopen", { reason }).then(() => setReopenOpen(false))}
            >
              Reopen
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Reopening unlocks this appraisal for correction. It keeps the configuration it was finalized under. Who reopened it, when, why, and
          the old and new scores are recorded. If this month&apos;s email has already gone to the employee, it is not re-sent automatically.
        </p>
        <div className="mt-4">
          <Textarea label="Reason (at least 10 characters)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Dialog>

      <AuditTrailDialog appraisalId={appraisal._id} open={auditOpen} onClose={() => setAuditOpen(false)} />
    </div>
  );
}
