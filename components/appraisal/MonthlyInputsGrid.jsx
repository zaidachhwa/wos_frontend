"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";

import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { Button, Select } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { fetchAppraisals, saveMonthlyInputs } from "@/services/appraisalsService";
import { fetchDepartments } from "@/services/orgService";
import { STATUS_LABELS, STATUS_TONES, apiError } from "@/lib/appraisal";

const cellInput =
  "w-20 rounded-input border border-border bg-surface px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-primary disabled:opacity-50";

// Spreadsheet-style entry of HR's monthly numbers for a whole department —
// no need to open each employee. Only edited rows are sent.
export default function MonthlyInputsGrid({ month }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [department, setDepartment] = useState("");
  const [edits, setEdits] = useState({}); // userId -> { leaves, lateMarks }

  const { data, isLoading } = useQuery({
    queryKey: ["appraisals", month, { department }],
    queryFn: () => fetchAppraisals({ month, department }),
  });
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: fetchDepartments });
  const rows = useMemo(() => [...(data?.rows || [])].sort((a, b) => (a.user.name || "").localeCompare(b.user.name || "")), [data]);

  const save = useMutation({
    mutationFn: () => saveMonthlyInputs({ month, rows: Object.entries(edits).map(([userId, v]) => ({ userId, ...v })) }),
    onSuccess: (res) => {
      const failed = res.data.results.filter((r) => !r.ok);
      if (failed.length) toast.error(`${res.message}: ${failed[0].message}`);
      else toast.success(res.message);
      setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([uid]) => failed.some((f) => f.userId === uid))));
      queryClient.invalidateQueries({ queryKey: ["appraisals"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const valueOf = (r, k) => edits[r.user._id]?.[k] ?? (r.hrInputs[k] ?? "");
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
            <option value="unassigned">Unassigned</option>
          </Select>
        </div>
        <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          <Save size={15} /> {save.isPending ? "Saving…" : `Save ${dirty ? `(${dirty})` : ""}`}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-80 w-full rounded-card" />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 text-right font-medium">Leaves</th>
                <th className="px-4 py-3 text-right font-medium">Late marks</th>
                <th className="px-4 py-3 text-right font-medium">Bugs</th>
                <th className="px-4 py-3 font-medium">HR evaluation</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const locked = r.status === "finalized";
                const edited = Boolean(edits[r.user._id]);
                return (
                  <tr key={r._id} className={`border-b border-border/60 last:border-0 ${edited ? "bg-info/5" : ""}`}>
                    <td className="px-4 py-2">
                      <Link href={`/appraisal/${r._id}`} className="font-medium hover:underline">
                        {r.user.name}
                      </Link>
                      <p className="text-xs text-muted">{r.department.name}</p>
                    </td>
                    {["leaves", "lateMarks"].map((k) => (
                      <td key={k} className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          max="31"
                          step={k === "leaves" ? "0.5" : "1"}
                          aria-label={`${r.user.name} ${k === "leaves" ? "leaves" : "late marks"}`}
                          disabled={locked}
                          value={valueOf(r, k)}
                          onChange={(e) => setValue(r, k, e.target.value)}
                          className={cellInput}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.bugs}
                      {r.bugsTotal > r.bugs && <span className="text-xs text-muted"> (+{r.bugsTotal - r.bugs} unconfirmed)</span>}
                    </td>
                    <td className="px-4 py-2">
                      <Link href={`/appraisal/${r._id}`} className="inline-flex items-center gap-2 hover:underline" title="Open to rate this employee">
                        <Badge
                          value={r.manualRated === r.manualTotal ? "Complete" : `${r.manualRated}/${r.manualTotal} rated`}
                          tone={r.manualRated === r.manualTotal ? "success" : "warning"}
                        />
                        {!locked && <span className="text-xs font-medium text-info">{r.manualRated === r.manualTotal ? "Review →" : "Rate →"}</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
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
