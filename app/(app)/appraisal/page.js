"use client";

import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Bug,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  GitPullRequestArrow,
  ListChecks,
} from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import Dialog from "@/components/ui/Dialog";
import { Button, Input } from "@/components/ui/Field";
import {
  fetchAppraisal,
  fetchMyAppraisal,
  fetchUserAppraisal,
  fetchAppraisalConfig,
  updateAppraisalConfig,
  downloadAppraisalCsv,
  downloadUserAppraisalCsv,
} from "@/services/appraisalService";
import { useAuthStore } from "@/store/authStore";
import useToast from "@/hooks/useToast";

// The department-wise roster is admin/hr only — not even subadmin — to
// mirror the backend's authorize("admin", "hr") on GET /appraisal. Everyone
// else only ever gets their own numbers via GET /appraisal/me, never the roster.
const ROSTER_ROLES = ["admin", "hr", "director"];

const monthStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const fmtMonth = (d) => new Date(d).toLocaleDateString(undefined, { month: "long", year: "numeric" });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");

// Driven by the server-computed `band` field (utils/performanceBand.js) —
// the same decision the monthly memo sweep makes, never a second cutoff.
const BAND_STYLE = {
  green: { text: "text-success", label: "Green" },
  yellow: { text: "text-warning", label: "Yellow" },
  red: { text: "text-danger", label: "Red" },
};
const bandTone = (band) => BAND_STYLE[band]?.text || "text-muted";
const bandLabel = (band) => BAND_STYLE[band]?.label || "—";

function MonthNav({ anchor, onShift, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onShift(-1)}
          aria-label="Previous month"
          className="rounded-btn border border-border p-2 text-muted hover:bg-surface hover:text-primary"
        >
          <ChevronLeft size={15} />
        </button>
        <p className="min-w-40 text-center text-sm font-medium">{fmtMonth(`${anchor}-01`)}</p>
        <button
          onClick={() => onShift(1)}
          aria-label="Next month"
          className="rounded-btn border border-border p-2 text-muted hover:bg-surface hover:text-primary"
        >
          <ChevronRight size={15} />
        </button>
      </div>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone = "" }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
        <Icon size={14} />
        {label}
      </div>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function DetailPanel({ icon: Icon, heading, empty, items, children }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon size={15} />
        {heading}
      </div>
      {items.length === 0 ? <p className="text-sm text-muted">{empty}</p> : <ul className="space-y-2.5 text-sm">{children}</ul>}
    </div>
  );
}

// Stat cards + itemized bug/client-change/late/leave panels — the same body
// for "my own appraisal" and for an admin/hr/subadmin drilling into someone
// else's, so both read identically.
function AppraisalDetailBody({ data }) {
  const totalTasks = data?.totalTasks ?? 0;
  const bugs = data?.bugs ?? 0;
  const clientChanges = data?.clientChanges ?? 0;
  const lates = data?.lates ?? 0;
  const leaves = data?.leaves ?? 0;
  const score = data?.score ?? null;

  // A task can be both a bug and a client change at once — it then shows up
  // in both lists, matching how it's counted twice in the score's defect
  // total (see appraisalController.js's defectCountOf).
  const taskEntries = [
    ...(data?.bugTasks || []).map((t) => ({ ...t, kind: "bug" })),
    ...(data?.clientChangeTasks || []).map((t) => ({ ...t, kind: "client" })),
  ].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  const attendanceEntries = [
    ...(data?.lateEntries || []).map((e) => ({ ...e, kind: "late" })),
    ...(data?.leaveEntries || []).map((e) => ({ ...e, kind: "leave" })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  if (totalTasks === 0 && lates === 0 && leaves === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        heading="Nothing to show yet"
        description="Appraisal numbers appear here once tasks are completed this month."
      />
    );
  }

  const minTasksForScore = data?.minTasksForScore;
  const tenureBand = data?.tenureBand;
  const tenureMonths = data?.tenureMonths;
  const BAND_LABEL = { new: "0–6 months", mid: "6–12 months", senior: "12+ months" };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard icon={ListChecks} label="Tasks done" value={totalTasks} />
        <StatCard icon={Bug} label="Bugs" value={bugs} />
        <StatCard icon={GitPullRequestArrow} label="Client changes" value={clientChanges} />
        <StatCard icon={Clock3} label="Late marks" value={lates} />
        <StatCard icon={CalendarOff} label="Leaves" value={leaves} />
        <StatCard icon={ClipboardCheck} label="Score" value={score === null ? "—" : `${score}%`} tone={bandTone(data?.band)} />
      </div>

      {score === null && typeof minTasksForScore === "number" && (
        <p className="text-xs text-muted">
          Score shows once {minTasksForScore} tasks are completed this month ({totalTasks}/{minTasksForScore} so
          far) — the threshold for the {BAND_LABEL[tenureBand] || "current"} tenure band ({tenureMonths} months in).
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DetailPanel icon={Bug} heading="Bugs & client changes" empty="None this month." items={taskEntries}>
          {taskEntries.map((t) => (
            <li key={`${t.kind}-${t._id}`} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2.5 last:border-0 last:pb-0">
              <span className="flex min-w-0 items-center gap-2">
                <Badge value={t.kind === "bug" ? "Bug" : "Client change"} tone={t.kind === "bug" ? "danger" : "warning"} />
                <span className="truncate">{t.title}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">{fmtDate(t.completedAt)}</span>
            </li>
          ))}
        </DetailPanel>

        <DetailPanel icon={Clock3} heading="Late marks & leaves" empty="None this month." items={attendanceEntries}>
          {attendanceEntries.map((e) => (
            <li key={e._id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2.5 last:border-0 last:pb-0">
              <span className="flex min-w-0 items-center gap-2">
                <Badge
                  value={e.kind === "late" ? "Late" : e.source === "auto" ? "Absent" : "Leave"}
                  tone={e.kind === "late" ? "warning" : "danger"}
                />
                {e.date}
              </span>
              <span className="max-w-[55%] truncate text-xs text-muted" title={e.note || ""}>
                {e.note || "—"}
              </span>
            </li>
          ))}
        </DetailPanel>
      </div>
    </div>
  );
}

function EmployeeDetailDialog({ userId, name, month, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ["user-appraisal", userId, month],
    queryFn: () => fetchUserAppraisal({ userId, month }),
    enabled: Boolean(userId),
  });

  return (
    <Dialog
      open={Boolean(userId)}
      onClose={onClose}
      title={name || "Appraisal detail"}
      footer={
        <Button
          variant="secondary"
          disabled={!data}
          onClick={() => downloadUserAppraisalCsv({ userId, month, name })}
        >
          <Download size={15} /> Download CSV
        </Button>
      }
    >
      {isLoading ? <Skeleton className="h-64 w-full rounded-card" /> : <AppraisalDetailBody data={data} />}
    </Dialog>
  );
}

function RosterTable({ rows, onSelectRow }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Person</th>
            <th className="px-4 py-3 font-medium">Team</th>
            <th className="px-4 py-3 font-medium">Tenure</th>
            <th className="px-4 py-3 text-right font-medium">Tasks done</th>
            <th className="px-4 py-3 text-right font-medium">Bugs</th>
            <th className="px-4 py-3 text-right font-medium">Client changes</th>
            <th className="px-4 py-3 text-right font-medium">Lates</th>
            <th className="px-4 py-3 text-right font-medium">Leaves</th>
            <th className="px-4 py-3 text-right font-medium">Score</th>
            <th className="px-4 py-3 text-right font-medium">Band</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.user._id}
              onClick={() => onSelectRow({ userId: row.user._id, name: row.user.name })}
              className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-background"
            >
              <td className="px-4 py-3">
                <p className="font-medium">{row.user.name}</p>
                <p className="text-xs text-muted">{row.user.designation || row.user.role}</p>
              </td>
              <td className="px-4 py-3 text-muted">{row.user.team?.name || "—"}</td>
              <td className="px-4 py-3 text-muted">
                {row.tenureMonths}mo <span className="capitalize">({row.tenureBand})</span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{row.totalTasks}</td>
              <td className="px-4 py-3 text-right tabular-nums">{row.bugs}</td>
              <td className="px-4 py-3 text-right tabular-nums">{row.clientChanges}</td>
              <td className="px-4 py-3 text-right tabular-nums">{row.lates}</td>
              <td className="px-4 py-3 text-right tabular-nums">{row.leaves}</td>
              <td className={`px-4 py-3 text-right font-semibold tabular-nums ${bandTone(row.band)}`}>
                {row.score === null ? "—" : `${row.score}%`}
              </td>
              <td className={`px-4 py-3 text-right font-medium ${bandTone(row.band)}`}>{bandLabel(row.band)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DepartmentSection({ id, name, rows, month, onSelectRow }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">
          {name} <span className="font-normal text-muted">({rows.length})</span>
        </h2>
        <Button
          variant="secondary"
          onClick={() =>
            downloadAppraisalCsv({
              month,
              department: id,
              filename: `appraisal-${name.replace(/\s+/g, "-")}-${month}.csv`,
            })
          }
        >
          <Download size={15} /> Download CSV
        </Button>
      </div>
      <RosterTable rows={rows} onSelectRow={onSelectRow} />
    </div>
  );
}

// Admin/hr-editable "how many completed tasks before a score shows" per
// tenure band. Same draft-overrides-server-value pattern as the HR portal's
// deadline control — no useEffect needed to sync a controlled input with an
// async query result.
function ScoringSettingsCard() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState(null); // null = untouched

  const { data: config } = useQuery({ queryKey: ["appraisal-config"], queryFn: fetchAppraisalConfig });
  const values = draft ?? {
    minTasksNew: config?.minTasksNew ?? 3,
    minTasksMid: config?.minTasksMid ?? 5,
    minTasksSenior: config?.minTasksSenior ?? 8,
  };

  const save = useMutation({
    mutationFn: () => updateAppraisalConfig(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appraisal-config"] });
      queryClient.invalidateQueries({ queryKey: ["appraisal"] });
      setDraft(null);
      toast.success("Scoring thresholds updated");
    },
    onError: (error) => toast.error(error.response?.data?.message || "Something went wrong"),
  });

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="mb-3 text-sm font-semibold">Minimum tasks before a score shows, by tenure</p>
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="0–6 months (new)"
          type="number"
          min="0"
          value={values.minTasksNew}
          onChange={(e) => setDraft({ ...values, minTasksNew: e.target.value })}
        />
        <Input
          label="6–12 months"
          type="number"
          min="0"
          value={values.minTasksMid}
          onChange={(e) => setDraft({ ...values, minTasksMid: e.target.value })}
        />
        <Input
          label="12+ months / TL"
          type="number"
          min="0"
          value={values.minTasksSenior}
          onChange={(e) => setDraft({ ...values, minTasksSenior: e.target.value })}
        />
        <Button variant="secondary" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">
        A newcomer needs fewer completed tasks before their score appears; someone with more tenure — a TL or
        senior — is expected to have handled more first. Same 100 − defects ÷ tasks formula either way.
      </p>
    </div>
  );
}

function AppraisalRoster() {
  const [anchor, setAnchor] = useState(() => monthStr(new Date()));
  const [selected, setSelected] = useState(null); // { userId, name }

  const { data, isLoading } = useQuery({
    queryKey: ["appraisal", anchor],
    queryFn: () => fetchAppraisal({ month: anchor }),
  });

  const shiftMonth = (delta) => {
    const [y, m] = anchor.split("-").map(Number);
    setAnchor(monthStr(new Date(y, m - 1 + delta, 1)));
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-card" />;
  }

  const rows = data?.rows || [];

  // Group by department — unassigned employees (no department set) get
  // their own group at the end rather than being dropped from the view.
  const groups = new Map();
  for (const row of rows) {
    const key = row.user.department?._id || "unassigned";
    const name = row.user.department?.name || "Unassigned";
    if (!groups.has(key)) groups.set(key, { id: key, name, rows: [] });
    groups.get(key).rows.push(row);
  }
  const departments = [...groups.values()].sort((a, b) => {
    if (a.id === "unassigned") return 1;
    if (b.id === "unassigned") return -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="mx-auto max-w-[1200px] space-y-8">
      <ScoringSettingsCard />

      <MonthNav anchor={anchor} onShift={shiftMonth}>
        <Button variant="secondary" disabled={!rows.length} onClick={() => downloadAppraisalCsv({ month: anchor })}>
          <Download size={15} /> Export all departments
        </Button>
      </MonthNav>

      <details className="rounded-card border border-border bg-surface p-4 text-xs text-muted">
        <summary className="cursor-pointer font-medium text-primary">How the monthly score is calculated</summary>
        <p className="mt-2">
          Score = 100 − (bugs + client-requested changes + late marks + leaves) ÷ completed tasks. Shown once the
          tenure-band task threshold above is met. Click a row for the itemized detail — which tasks were bugs,
          which days were late or on leave, and when.
        </p>
        <p className="mt-2">
          Each team sets its own Red/Yellow/Green score cutoffs (under Departments &amp; Teams). A Red month
          automatically issues a performance memo — the first 3 push back the employee&apos;s next review date by 3
          weeks each, the 4th flags the account for admin review.
        </p>
      </details>

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} heading="No one to appraise yet" description="Scores appear here once tasks are completed this month." />
      ) : (
        departments.map((dept) => (
          <DepartmentSection
            key={dept.id}
            id={dept.id}
            name={dept.name}
            rows={dept.rows}
            month={anchor}
            onSelectRow={setSelected}
          />
        ))
      )}

      <EmployeeDetailDialog
        userId={selected?.userId}
        name={selected?.name}
        month={anchor}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function MyAppraisal() {
  const [anchor, setAnchor] = useState(() => monthStr(new Date()));

  const { data, isLoading } = useQuery({
    queryKey: ["my-appraisal", anchor],
    queryFn: () => fetchMyAppraisal({ month: anchor }),
  });

  const shiftMonth = (delta) => {
    const [y, m] = anchor.split("-").map(Number);
    setAnchor(monthStr(new Date(y, m - 1 + delta, 1)));
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-card" />;
  }

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <MonthNav anchor={anchor} onShift={shiftMonth} />

      <p className="text-xs text-muted">
        Score = 100 − (bugs + client-requested changes + late marks + leaves) ÷ completed tasks.
      </p>

      <AppraisalDetailBody data={data} />
    </div>
  );
}

export default function AppraisalPage() {
  const me = useAuthStore((s) => s.user);
  const isRosterView = ROSTER_ROLES.includes(me?.role);

  return isRosterView ? <AppraisalRoster /> : <MyAppraisal />;
}
