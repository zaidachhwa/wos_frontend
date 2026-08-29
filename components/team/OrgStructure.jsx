"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";

import { Input, Select, Button } from "@/components/ui/Field";
import {
  createDepartment,
  deleteDepartment,
  createTeam,
  deleteTeam,
  updateTeamThresholds,
} from "@/services/orgService";

// Inline Red/Yellow/Green threshold editor for one team row. Own local
// draft state since each row saves independently of the others.
function ThresholdEditor({ team, onSaved }) {
  const [draft, setDraft] = useState({
    red: team.performanceThresholds?.red ?? 50,
    yellow: team.performanceThresholds?.yellow ?? 80,
  });
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () => updateTeamThresholds({ id: team._id, red: Number(draft.red), yellow: Number(draft.yellow) }),
    onSuccess: () => {
      setError("");
      onSaved();
    },
    onError: (e) => setError(e.response?.data?.message || "Something went wrong"),
  });

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-border/60 pt-2">
      <div className="w-24">
        <Input
          label="Red below"
          type="number"
          value={draft.red}
          onChange={(e) => setDraft({ ...draft, red: e.target.value })}
        />
      </div>
      <div className="w-24">
        <Input
          label="Green at/above"
          type="number"
          value={draft.yellow}
          onChange={(e) => setDraft({ ...draft, yellow: e.target.value })}
        />
      </div>
      <Button
        variant="secondary"
        className="mb-0.5"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        Save
      </Button>
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </div>
  );
}

export default function OrgStructure({ departments, teams, me }) {
  const canManageDepartments = me?.role === "admin";
  const managedTeamId = String(me?.managedTeam?._id || me?.managedTeam || "");
  const canEditThresholds = (t) => canManageDepartments || (me?.role === "manager" && String(t._id) === managedTeamId);
  const queryClient = useQueryClient();
  const [deptName, setDeptName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamDept, setTeamDept] = useState("");
  const [error, setError] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["departments"] });
    queryClient.invalidateQueries({ queryKey: ["teams"] });
  };
  const onError = (e) => setError(e.response?.data?.message || "Something went wrong");

  const addDept = useMutation({
    mutationFn: () => createDepartment({ name: deptName }),
    onSuccess: () => {
      setDeptName("");
      setError("");
      invalidate();
    },
    onError,
  });
  const removeDept = useMutation({ mutationFn: deleteDepartment, onSuccess: invalidate, onError });
  const addTeam = useMutation({
    mutationFn: () => createTeam({ name: teamName, department: canManageDepartments ? teamDept : me?.managedDepartment?._id }),
    onSuccess: () => {
      setTeamName("");
      setError("");
      invalidate();
    },
    onError,
  });
  const removeTeam = useMutation({ mutationFn: deleteTeam, onSuccess: invalidate, onError });

  const deptNameOf = (team) =>
    team.department?.name || departments.find((d) => d._id === team.department)?.name || "—";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {error && (
        <p role="alert" className="lg:col-span-2 rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {canManageDepartments && (
      <section className="rounded-card border border-border bg-surface p-6">
        <h3 className="text-base font-semibold tracking-tight">Departments</h3>
        <div className="mt-4 flex gap-2">
          <div className="flex-1">
            <Input
              aria-label="New department name"
              placeholder="e.g. Engineering"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
            />
          </div>
          <Button className="mt-1" disabled={!deptName.trim() || addDept.isPending} onClick={() => addDept.mutate()}>
            <Plus size={16} /> Add
          </Button>
        </div>
        <ul className="mt-4 divide-y divide-border/60">
          {departments.map((d) => (
            <li key={d._id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="font-medium">{d.name}</span>
              <button
                onClick={() => removeDept.mutate(d._id)}
                aria-label={`Delete ${d.name}`}
                className="rounded-btn p-1.5 text-muted transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
          {!departments.length && <li className="py-2.5 text-sm text-muted">No departments yet.</li>}
        </ul>
      </section>
      )}

      <section className="rounded-card border border-border bg-surface p-6">
        <h3 className="text-base font-semibold tracking-tight">Teams</h3>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            aria-label="New team name"
            placeholder="e.g. Platform"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />
          <Select
            aria-label="Team department"
            value={canManageDepartments ? teamDept : me?.managedDepartment?._id || ""}
            disabled={!canManageDepartments}
            onChange={(e) => setTeamDept(e.target.value)}
          >
            <option value="">Department…</option>
            {(canManageDepartments ? departments : departments.filter((d) => d._id === me?.managedDepartment?._id)).map(
              (d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              )
            )}
          </Select>
          <Button
            className="mt-1"
            disabled={
              !teamName.trim() || !(canManageDepartments ? teamDept : me?.managedDepartment?._id) || addTeam.isPending
            }
            onClick={() => addTeam.mutate()}
          >
            <Plus size={16} /> Add
          </Button>
        </div>
        <ul className="mt-4 divide-y divide-border/60">
          {teams.map((t) => (
            <li key={t._id} className="py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span>
                  <span className="font-medium">{t.name}</span>
                  <span className="ml-2 text-xs text-muted">{deptNameOf(t)}</span>
                </span>
                <button
                  onClick={() => removeTeam.mutate(t._id)}
                  aria-label={`Delete ${t.name}`}
                  className="rounded-btn p-1.5 text-muted transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {canEditThresholds(t) && <ThresholdEditor team={t} onSaved={invalidate} />}
            </li>
          ))}
          {!teams.length && <li className="py-2.5 text-sm text-muted">No teams yet.</li>}
        </ul>
      </section>
    </div>
  );
}
