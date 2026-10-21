"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareQuote, Save } from "lucide-react";

import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { Button, Select } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { useAuthStore } from "@/store/authStore";
import { fetchAppraisals, saveDirectorInputs } from "@/services/appraisalsService";
import { fetchBonusRequests } from "@/services/peopleService";
import { fetchDepartments } from "@/services/orgService";
import { STATUS_LABELS, STATUS_TONES, apiError, fmtScore } from "@/lib/appraisal";

const cellInput =
  "w-20 rounded-input border border-border bg-surface px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-primary disabled:opacity-50";

// Preview only — the server recomputes and stores the real numbers.
const preview = (base, director, bonus) => {
  if (base === null || base === undefined) return { converted: null, final: null };
  const converted = ((Number(base) + (director === "" || director === null ? 0 : Number(director))) / 120) * 100;
  return { converted, final: converted + (Number(bonus) || 0) };
};

export default function DirectorBonusGrid({ month }) {
  const role = useAuthStore((s) => s.user?.role);
  const canScore = ["director", "admin", "head_of_technical_operations"].includes(role);
  const canBonus = ["hr", "director", "admin", "head_of_technical_operations"].includes(role);
  const canSeeBonusRequests = ["admin", "hr", "director"].includes(role);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [department, setDepartment] = useState("");
  const [edits, setEdits] = useState({}); // userId -> { directorScore, bonusPct, bonusReason }

  const { data, isLoading } = useQuery({ queryKey: ["appraisals", month, { department }], queryFn: () => fetchAppraisals({ month, department }) });
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: fetchDepartments });
  const { data: requestsData } = useQuery({ queryKey: ["bonus-requests", month], queryFn: () => fetchBonusRequests(month), enabled: canSeeBonusRequests });
  const requestByUser = useMemo(() => new Map((requestsData?.requests || []).map((r) => [String(r.user?._id), r])), [requestsData]);
  const rows = data?.rows || [];

  const save = useMutation({
    mutationFn: () => saveDirectorInputs({ month, rows: Object.entries(edits).map(([userId, v]) => ({ userId, ...v })) }),
    onSuccess: (res) => {
      const failed = res.data.results.filter((r) => !r.ok);
      if (failed.length) toast.error(`${res.message}: ${failed[0].message}`);
      else toast.success(res.message);
      setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([uid]) => failed.some((f) => String(f.userId) === uid))));
      queryClient.invalidateQueries({ queryKey: ["appraisals"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const valueOf = (r, k, fallback) => edits[r.user._id]?.[k] ?? fallback;
  const setValue = (r, k, v) => setEdits((prev) => ({ ...prev, [r.user._id]: { ...prev[r.user._id], [k]: v } }));
  const dirty = Object.keys(edits).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-64">
          <Select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          <Save size={15} /> {save.isPending ? "Saving…" : `Save${dirty ? ` (${dirty})` : ""}`}
        </Button>
      </div>
      <p className="text-xs text-muted">
        Final = (criteria score out of 100 + Director&apos;s assessment out of 20) ÷ 120 × 100, then + special bonus %. Example: 98 + 15 →
        94.17, + 5% bonus → 99.17. The Director&apos;s assessment is required before an appraisal can be finalized.
      </p>

      {isLoading ? (
        <Skeleton className="h-80 w-full rounded-card" />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-3 font-medium">Employee</th>
                <th className="px-3 py-3 text-right font-medium">Criteria /100</th>
                <th className="px-3 py-3 text-right font-medium">Director /20</th>
                <th className="px-3 py-3 text-right font-medium">Converted</th>
                <th className="px-3 py-3 text-right font-medium">Bonus %</th>
                <th className="px-3 py-3 font-medium">Bonus reason</th>
                <th className="px-3 py-3 text-right font-medium">Final</th>
                <th className="px-3 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const locked = r.status === "finalized";
                const director = valueOf(r, "directorScore", r.directorScore ?? "");
                const bonus = valueOf(r, "bonusPct", r.bonusPct || "");
                const p = edits[r.user._id] ? preview(r.baseScore, director, bonus) : { converted: r.convertedScore, final: r.totalScore };
                const request = requestByUser.get(String(r.user._id));
                return (
                  <tr key={r._id} className={`border-b border-border/60 last:border-0 ${edits[r.user._id] ? "bg-info/5" : ""}`}>
                    <td className="px-3 py-2">
                      <Link href={`/appraisal/${r._id}`} className="font-medium hover:underline">
                        {r.user.name}
                      </Link>
                      <p className="text-xs text-muted">{r.department.name}</p>
                      {canSeeBonusRequests && request && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-info" title={request.reason}>
                          <MessageSquareQuote size={12} /> Requested a bonus
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.baseScore === null ? "—" : fmtScore(r.baseScore)}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="0.5"
                        aria-label={`${r.user.name} director assessment`}
                        disabled={!canScore || locked}
                        value={director}
                        onChange={(e) => setValue(r, "directorScore", e.target.value)}
                        className={cellInput}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{p.converted === null ? "—" : fmtScore(p.converted)}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        aria-label={`${r.user.name} special bonus`}
                        disabled={!canBonus || locked}
                        value={bonus}
                        onChange={(e) => setValue(r, "bonusPct", e.target.value)}
                        className={cellInput}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        aria-label={`${r.user.name} bonus reason`}
                        disabled={!canBonus || locked}
                        placeholder={Number(bonus) > 0 ? "Required" : ""}
                        value={valueOf(r, "bonusReason", r.bonusReason || "")}
                        onChange={(e) => setValue(r, "bonusReason", e.target.value)}
                        className="w-48 rounded-input border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary disabled:opacity-50"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{p.final === null ? "—" : fmtScore(p.final)}</td>
                    <td className="px-3 py-2">
                      <Badge value={STATUS_LABELS[r.status]} tone={STATUS_TONES[r.status]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
