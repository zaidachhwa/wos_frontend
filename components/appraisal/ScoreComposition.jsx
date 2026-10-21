"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button, Input } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { saveDirectorAssessment, saveSpecialBonus } from "@/services/appraisalsService";
import { apiError, fmtScore } from "@/lib/appraisal";

// How the final score is built: criteria /100 + Director /20 → /100, then
// + special bonus %. Director (and admin) edit the 20; HR/Director/Admin
// edit the bonus — the server enforces both.
export default function ScoreComposition({ appraisal: a, queryKey }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const locked = a.status === "finalized";
  const [score, setScore] = useState(null); // null = untouched
  const [comment, setComment] = useState(null);
  const [pct, setPct] = useState(null);
  const [reason, setReason] = useState(null);

  const onSuccess = (fresh) => {
    queryClient.setQueryData(queryKey, fresh);
    queryClient.invalidateQueries({ queryKey: ["appraisals"] });
  };
  const saveScore = useMutation({
    mutationFn: () => saveDirectorAssessment({ id: a._id, score: score ?? a.directorAssessment?.score ?? null, comment: comment ?? a.directorAssessment?.comment ?? "" }),
    onSuccess: (fresh) => {
      onSuccess(fresh);
      setScore(null);
      setComment(null);
      toast.success("Director's assessment saved");
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const saveBonus = useMutation({
    mutationFn: () => saveSpecialBonus({ id: a._id, pct: pct ?? a.specialBonus?.pct ?? 0, reason: reason ?? a.specialBonus?.reason ?? "" }),
    onSuccess: (fresh) => {
      onSuccess(fresh);
      setPct(null);
      setReason(null);
      toast.success("Special bonus saved");
    },
    onError: (e) => toast.error(apiError(e)),
  });

  // Appraisals finalized before this feature only have the criteria total.
  if (a.baseScore === null || a.baseScore === undefined) return null;
  const directorScore = a.directorAssessment?.score;

  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">Score composition</h2>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Criteria score</dt>
          <dd className="tabular-nums">{fmtScore(a.baseScore)} / 100</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Director&apos;s assessment</dt>
          <dd className="tabular-nums">{directorScore === null || directorScore === undefined ? "Not given" : `${fmtScore(directorScore)} / 20`}</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-1.5">
          <dt className="text-muted">Converted (÷ 120 × 100)</dt>
          <dd className="tabular-nums">{fmtScore(a.convertedScore)} / 100</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Special bonus</dt>
          <dd className="tabular-nums">+{fmtScore(a.specialBonus?.pct || 0)}%</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
          <dt>Final score</dt>
          <dd className="tabular-nums">{fmtScore(a.totalScore)}</dd>
        </div>
      </dl>
      {a.directorAssessment?.comment && <p className="mt-3 text-xs text-muted">Director: {a.directorAssessment.comment}</p>}
      {a.specialBonus?.pct > 0 && a.specialBonus?.reason && <p className="mt-1 text-xs text-muted">Bonus: {a.specialBonus.reason}</p>}

      {a.canDirectorScore && !locked && (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <Input label="Director /20" type="number" min="0" max="20" step="0.5" value={score ?? directorScore ?? ""} onChange={(e) => setScore(e.target.value)} />
            <Input label="Comment (optional)" value={comment ?? a.directorAssessment?.comment ?? ""} onChange={(e) => setComment(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" disabled={saveScore.isPending || (score === null && comment === null)} onClick={() => saveScore.mutate()}>
              Save assessment
            </Button>
          </div>
        </div>
      )}
      {a.canBonus && !locked && (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <Input label="Bonus %" type="number" min="0" max="100" step="0.5" value={pct ?? a.specialBonus?.pct ?? 0} onChange={(e) => setPct(e.target.value)} />
            <Input label="Reason" value={reason ?? a.specialBonus?.reason ?? ""} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" disabled={saveBonus.isPending || (pct === null && reason === null)} onClick={() => saveBonus.mutate()}>
              Save bonus
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
