"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Clock3, Download, MapPin, Pencil, Search, ShieldAlert, Sparkles, Trash2, UserPlus } from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import { Input, Select, Textarea, Button } from "@/components/ui/Field";
import UserDialog from "@/components/team/UserDialog";
import {
  fetchAttendance,
  markAttendance,
  deleteAttendance,
  fetchAttendanceConfig,
  updateAttendanceConfig,
  fetchAttendanceReport,
  downloadAttendanceReportCsv,
  fetchUserDeadlines,
  setUserMorningDeadline,
} from "@/services/attendanceService";
import { fetchUsers, fetchDepartments, fetchTeams, updateUser } from "@/services/orgService";
import { getCurrentLocation } from "@/lib/geolocation";
import { useAuthStore } from "@/store/authStore";
import useToast from "@/hooks/useToast";

// Roles that actually do task work — the ones an HR appraisal note (late /
// leave) is meant to apply to.
const TRACKED_ROLES = ["manager", "sublead", "member", "qa"];
const ROLE_TONES = { admin: "danger", manager: "info", subadmin: "success", sublead: "warning", member: "muted", hr: "info", qa: "warning", director: "success" };

const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const monthStr = () => todayStr().slice(0, 7);

// An auto-generated "leave" (no morning follow-up submitted at all) reads
// as "Absent" to HR — manual leave entries (HR recording an approved day
// off) keep the "Leave" label. Same underlying `type: "leave"`, so it still
// rolls into the same appraisal bucket either way.
const labelFor = (r) => (r.type === "leave" && r.source === "auto" ? "Absent" : r.type === "leave" ? "Leave" : "Late");
const iconFor = (r) => (r.type === "late" ? Clock3 : CalendarOff);
const toneFor = (r) => (r.type === "late" ? "text-warning" : "text-danger");

// One row = one employee's shift times and morning deadline override.
function MemberShiftRow({ user, orgDeadline, onSaved, onEditDetails }) {
  const toast = useToast();
  const [shiftStart, setShiftStart] = useState(user.shiftStart || "");
  const [shiftEnd, setShiftEnd] = useState(user.shiftEnd || "");
  const [morningDeadline, setMorningDeadline] = useState(user.morningDeadline || "");

  const dirty =
    shiftStart !== (user.shiftStart || "") ||
    shiftEnd !== (user.shiftEnd || "") ||
    morningDeadline !== (user.morningDeadline || "");

  const save = useMutation({
    mutationFn: () =>
      updateUser({
        id: user._id,
        shiftStart: shiftStart || null,
        shiftEnd: shiftEnd || null,
        morningDeadline: morningDeadline || null,
      }),
    onSuccess: () => {
      onSaved();
      toast.success(`Updated shift & timings for ${user.name}`);
    },
    onError: (error) => toast.error(error.response?.data?.message || "Something went wrong"),
  });

  return (
    <tr className="border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-background/40">
      <td className="px-4 py-3">
        <p className="font-medium">{user.name}</p>
        <p className="text-xs text-muted">{user.designation || user.email || "—"}</p>
      </td>
      <td className="px-4 py-3">
        <Badge value={user.role} tone={ROLE_TONES[user.role] || "muted"} />
      </td>
      <td className="px-4 py-3 text-muted">
        {user.team?.name || user.department?.name || "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Input
            aria-label={`${user.name}'s shift start`}
            type="time"
            value={shiftStart}
            onChange={(e) => setShiftStart(e.target.value)}
            className="w-24"
          />
          <span className="text-xs text-muted">to</span>
          <Input
            aria-label={`${user.name}'s shift end`}
            type="time"
            value={shiftEnd}
            onChange={(e) => setShiftEnd(e.target.value)}
            className="w-24"
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Input
            aria-label={`${user.name}'s morning deadline`}
            type="time"
            value={morningDeadline}
            onChange={(e) => setMorningDeadline(e.target.value)}
            className="w-24"
          />
          {morningDeadline ? (
            <Badge value="Custom" tone="info" />
          ) : (
            <Badge value={`Default (${orgDeadline})`} tone="muted" />
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
            className="px-2.5 py-1 text-xs"
          >
            Save
          </Button>
          <Button
            variant="ghost"
            aria-label={`Edit full details for ${user.name}`}
            onClick={() => onEditDetails(user)}
            className="p-1.5 text-muted hover:text-primary"
            title="Edit full profile details"
          >
            <Pencil size={15} />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function MemberShiftsTab({ orgDeadline, onEditUser }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const { data: users = [], isLoading } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: fetchDepartments });

  const onSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["user-deadlines"] });
  };

  const filtered = useMemo(() => {
    let list = users || [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          (u.designation || "").toLowerCase().includes(q)
      );
    }
    if (roleFilter) list = list.filter((u) => u.role === roleFilter);
    if (departmentFilter) list = list.filter((u) => u.department?._id === departmentFilter || u.department === departmentFilter);
    return list;
  }, [users, search, roleFilter, departmentFilter]);

  if (isLoading) return <Skeleton className="h-64 w-full rounded-card" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Manage shift timings and morning follow-up deadlines for all members. Individual deadlines override the org default ({orgDeadline}).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              aria-label="Search members"
              placeholder="Search member…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 rounded-input border border-border bg-surface py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary"
            />
          </div>
          <select
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-input border border-border bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-primary"
          >
            <option value="">All roles</option>
            <option value="member">Member</option>
            <option value="sublead">Sub Lead</option>
            <option value="manager">Manager</option>
            <option value="qa">QA</option>
            <option value="hr">HR</option>
            <option value="subadmin">Sub Admin</option>
          </select>
          <select
            aria-label="Filter by department"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="rounded-input border border-border bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-primary"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Clock3}
          heading={search || roleFilter ? "No members match your filters" : "No members found"}
          description="Members and their shift schedules will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Team / Dept</th>
                <th className="px-4 py-3 font-medium">Shift Timing</th>
                <th className="px-4 py-3 font-medium">Morning Deadline</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <MemberShiftRow
                  key={u._id}
                  user={u}
                  orgDeadline={orgDeadline}
                  onSaved={onSaved}
                  onEditDetails={onEditUser}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function HrPortalPage() {
  const me = useAuthStore((s) => s.user);
  const isHr = ["admin", "hr"].includes(me?.role);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState("mark");
  const [month, setMonth] = useState(() => monthStr());
  const [form, setForm] = useState({ user: "", date: todayStr(), type: "late", note: "" });
  const [apiError, setApiError] = useState("");
  const [dialogUser, setDialogUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // null = untouched — falls back to the server value until the user edits it.
  const [draftDeadline, setDraftDeadline] = useState(null);
  const [draftOffice, setDraftOffice] = useState(null);
  const [locatingOffice, setLocatingOffice] = useState(false);

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: fetchUsers, enabled: isHr });
  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: fetchDepartments, enabled: isHr });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: fetchTeams, enabled: isHr });
  const employees = useMemo(() => users.filter((u) => TRACKED_ROLES.includes(u.role)), [users]);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance", month],
    queryFn: () => fetchAttendance({ month }),
    enabled: isHr && tab === "mark",
  });

  const { data: report = [], isLoading: reportLoading } = useQuery({
    queryKey: ["attendance-report", month],
    queryFn: () => fetchAttendanceReport({ month }),
    enabled: isHr && tab === "report",
  });

  const { data: config } = useQuery({ queryKey: ["attendance-config"], queryFn: fetchAttendanceConfig, enabled: isHr });
  const deadline = draftDeadline ?? config?.morningDeadline ?? "10:00";
  const office = draftOffice ?? {
    lat: config?.officeLat ?? "",
    lng: config?.officeLng ?? "",
    radiusMeters: config?.officeRadiusMeters ?? 300,
  };
  const officeConfigured = Boolean(config?.officeLat && config?.officeLng);

  const mark = useMutation({
    onMutate: () => setApiError(""),
    mutationFn: () => markAttendance(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-report"] });
      toast.success(`${form.type === "late" ? "Late" : "Leave"} marked`);
      setForm((f) => ({ ...f, note: "" }));
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Something went wrong";
      setApiError(message);
      toast.error(message);
    },
  });

  const remove = useMutation({
    mutationFn: (id) => deleteAttendance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-report"] });
      toast.success("Entry removed");
    },
    onError: (error) => toast.error(error.response?.data?.message || "Something went wrong"),
  });

  const saveDeadline = useMutation({
    mutationFn: () => updateAttendanceConfig({ morningDeadline: deadline }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-config"] });
      setDraftDeadline(null);
      toast.success("Morning follow-up deadline updated");
    },
    onError: (error) => toast.error(error.response?.data?.message || "Something went wrong"),
  });

  const saveOffice = useMutation({
    mutationFn: () =>
      updateAttendanceConfig({
        officeLat: Number(office.lat),
        officeLng: Number(office.lng),
        officeRadiusMeters: Number(office.radiusMeters),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-config"] });
      setDraftOffice(null);
      toast.success("Office location updated");
    },
    onError: (error) => toast.error(error.response?.data?.message || "Something went wrong"),
  });

  const useMyLocation = async () => {
    setLocatingOffice(true);
    try {
      const loc = await getCurrentLocation();
      setDraftOffice({ ...office, lat: loc.lat.toFixed(6), lng: loc.lng.toFixed(6) });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLocatingOffice(false);
    }
  };

  if (!isHr) {
    return (
      <EmptyState
        icon={ShieldAlert}
        heading="HR only"
        description="This portal is for tracking employee attendance — late arrivals and leaves feed straight into their appraisal."
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">HR portal</h1>
        <p className="mt-1 text-sm text-muted">
          Attendance is read off the morning follow-up: no submission for the day auto-marks someone absent,
          a late submission auto-marks them late. Every entry counts against that month&apos;s appraisal score.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4">
        <Sparkles size={16} className="mb-2.5 text-muted" />
        <Input
          label="Morning follow-up deadline (IST)"
          type="time"
          value={deadline}
          onChange={(e) => setDraftDeadline(e.target.value)}
        />
        <Button
          variant="secondary"
          disabled={saveDeadline.isPending || deadline === config?.morningDeadline}
          onClick={() => saveDeadline.mutate()}
        >
          {saveDeadline.isPending ? "Saving…" : "Save"}
        </Button>
        <p className="mb-2 text-xs text-muted">
          Submitting the morning follow-up after this time auto-marks someone late; not submitting at all marks
          them absent. Checked once daily, in the evening.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4">
        <MapPin size={16} className="mb-2.5 text-muted" />
        <Input
          label="Office latitude"
          type="number"
          step="any"
          value={office.lat}
          onChange={(e) => setDraftOffice({ ...office, lat: e.target.value })}
        />
        <Input
          label="Office longitude"
          type="number"
          step="any"
          value={office.lng}
          onChange={(e) => setDraftOffice({ ...office, lng: e.target.value })}
        />
        <Input
          label="Radius (meters)"
          type="number"
          min="10"
          value={office.radiusMeters}
          onChange={(e) => setDraftOffice({ ...office, radiusMeters: e.target.value })}
        />
        <Button variant="secondary" type="button" disabled={locatingOffice} onClick={useMyLocation}>
          {locatingOffice ? "Locating…" : "Use my current location"}
        </Button>
        <Button disabled={saveOffice.isPending || !office.lat || !office.lng} onClick={() => saveOffice.mutate()}>
          {saveOffice.isPending ? "Saving…" : "Save"}
        </Button>
        <p className="mb-2 w-full text-xs text-muted">
          {officeConfigured
            ? "Follow-up submissions (morning and evening) are only accepted within this radius of the office."
            : "Not set yet — follow-up submissions aren't location-locked until coordinates are saved here."}
        </p>
      </div>

      <div className="flex gap-1 self-start rounded-btn border border-border bg-surface p-1">
        {[
          ["mark", "Mark attendance"],
          ["report", "Monthly report"],
          ["shifts", "Member shifts & details"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              tab === key ? "bg-primary text-primary-foreground" : "text-muted hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "mark" ? (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.user) return;
              mark.mutate();
            }}
            className="grid grid-cols-1 gap-4 rounded-card border border-border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {apiError && (
              <p role="alert" className="sm:col-span-2 lg:col-span-4 rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {apiError}
              </p>
            )}
            <Select
              label="Employee"
              value={form.user}
              onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))}
              required
            >
              <option value="">Select…</option>
              {employees.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </Select>
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
            <Select label="Type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="late">Late</option>
              <option value="leave">Leave</option>
            </Select>
            <div className="flex items-end">
              <Button type="submit" disabled={!form.user || mark.isPending} className="w-full gap-2">
                <UserPlus size={16} />
                {mark.isPending ? "Saving…" : "Mark"}
              </Button>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Textarea
                label="Note (optional)"
                rows={2}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
          </form>

          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight">This month&apos;s entries</h2>
            <Input aria-label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-card" />
          ) : records.length === 0 ? (
            <EmptyState icon={Clock3} heading="No entries yet" description="Auto-detected and manually marked entries will show up here." />
          ) : (
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 font-medium">Person</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Note</th>
                    <th className="px-4 py-3 font-medium">Marked by</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const Icon = iconFor(r);
                    return (
                      <tr key={r._id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-medium">{r.user?.name}</p>
                          <p className="text-xs text-muted">{r.user?.designation || r.user?.role}</p>
                        </td>
                        <td className="px-4 py-3 text-muted">{r.date}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <Icon size={14} className={toneFor(r)} />
                            {labelFor(r)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge value={r.source === "auto" ? "Auto" : "Manual"} tone={r.source === "auto" ? "info" : "muted"} />
                        </td>
                        <td className="px-4 py-3 text-muted">{r.note || "—"}</td>
                        <td className="px-4 py-3 text-muted">{r.markedBy?.name || "System"}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => remove.mutate(r._id)}
                            aria-label="Delete entry"
                            className="rounded-btn p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : tab === "report" ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight">Monthly leaves &amp; late marks</h2>
            <div className="flex items-center gap-2">
              <Input aria-label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              <Button variant="secondary" disabled={!report.length} onClick={() => downloadAttendanceReportCsv({ month })}>
                <Download size={15} /> Export CSV
              </Button>
            </div>
          </div>

          {reportLoading ? (
            <Skeleton className="h-64 w-full rounded-card" />
          ) : report.length === 0 ? (
            <EmptyState icon={Clock3} heading="Nothing to report" description="No tracked employees found for this month." />
          ) : (
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 font-medium">Person</th>
                    <th className="px-4 py-3 font-medium">Team</th>
                    <th className="px-4 py-3 text-right font-medium">Late marks</th>
                    <th className="px-4 py-3 text-right font-medium">Leaves</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((r) => (
                    <tr key={r.user._id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.user.name}</p>
                        <p className="text-xs text-muted">{r.user.designation || r.user.role}</p>
                      </td>
                      <td className="px-4 py-3 text-muted">{r.user.team?.name || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.lates}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.leaves}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <MemberShiftsTab
          orgDeadline={config?.morningDeadline ?? "10:00"}
          onEditUser={(u) => {
            setDialogUser(u);
            setDialogOpen(true);
          }}
        />
      )}

      {dialogOpen && (
        <UserDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          user={dialogUser}
          directory={users || []}
          departments={departments}
          teams={teams}
          actor={me}
        />
      )}
    </div>
  );
}

