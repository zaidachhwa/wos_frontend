"use client";

import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, CheckCircle, AlertTriangle } from "lucide-react";

import DepartmentPicker from "@/components/appraisal/settings/DepartmentPicker";
import Dialog from "@/components/ui/Dialog";
import { Button, Input, Select, Textarea } from "@/components/ui/Field";
import Badge from "@/components/ui/Badge";
import useToast from "@/hooks/useToast";
import { createCriterion, updateCriterion } from "@/services/appraisalsService";
import { fetchTeams } from "@/services/orgService";
import { METHOD_LABELS, POSITION_LABELS, TYPE_LABELS, apiError } from "@/lib/appraisal";

const num = () => yup.number().transform((v, o) => (o === "" || o === null ? undefined : v));

const schema = yup.object({
  name: yup.string().trim().required("Name is required"),
  description: yup.string(),
  parentCriterion: yup.string().nullable(),
  frequency: yup.string().required("Frequency is required"),
  scoreFromSubCriteria: yup.boolean(),
  positionsScope: yup.string().oneOf(["all", "selected"]),
  positions: yup.array(),
  teamsScope: yup.string().oneOf(["all", "selected"]),
  teams: yup.array().when("teamsScope", {
    is: "selected",
    then: (s) => s.min(1, "Tick at least one team, or choose All teams"),
  }),
  type: yup.string().required(),
  weightage: num().required("Weightage is required").min(0).max(100),
  metric: yup.string().when("type", { is: (t) => t !== "manual", then: (s) => s.required("Choose a data source") }),
  scoringMethod: yup.string().required(),
  isActive: yup.boolean(),
  params: yup.object({
    target: num(),
    unitPct: num().min(0),
    freeUnits: num().min(0),
    floorPct: num().min(0).max(100),
    noDataPct: num().min(0).max(100),
  }),
  ratingOptions: yup.array().of(
    yup.object({
      label: yup.string().trim().required("Label required"),
      pct: num().required("% required").min(0).max(100),
    })
  ),
  bands: yup.array().of(yup.object({ min: num().required(), max: num(), pct: num().required().min(0).max(100) })),
  scope: yup.string().oneOf(["all", "selected"]),
  departments: yup.array().when("scope", {
    is: "selected",
    then: (s) => s.min(1, "Tick at least one department, or choose All departments"),
  }),
});

const DEFAULT_RATINGS = [
  { label: "Poor", pct: 25 },
  { label: "Average", pct: 50 },
  { label: "Good", pct: 100 },
];

const FREQUENCIES = [
  ["daily", "Daily (one evaluation per day)"],
  ["weekly", "Weekly (one evaluation per week, Monday–Saturday)"],
  ["biweekly", "Biweekly (one evaluation per 2 weeks, 1st Monday–2nd Saturday)"],
  ["monthly", "Monthly (one evaluation per month, 1st–last day)"],
];

export default function CriterionDialog({
  open,
  onClose: onCloseProp,
  criterion,
  catalog,
  departments = [],
  criteria = [],
}) {
  const isEdit = Boolean(criterion);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const onClose = () => {
    setError("");
    onCloseProp();
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema) });

  const ratings = useFieldArray({ control, name: "ratingOptions" });
  const bands = useFieldArray({ control, name: "bands" });

  useEffect(() => {
    if (!open) return;
    reset({
      name: criterion?.name || "",
      description: criterion?.description || "",
      parentCriterion: criterion?.parentCriterion ? String(criterion.parentCriterion?._id || criterion.parentCriterion) : "",
      frequency: criterion?.frequency || "monthly",
      scoreFromSubCriteria: criterion?.scoreFromSubCriteria ?? true,
      positionsScope: criterion?.positions?.length ? "selected" : "all",
      // Only base roles are valid positions; older free-text designations are dropped.
      positions: (criterion?.positions || []).filter((p) => POSITION_LABELS[p]),
      teamsScope: criterion?.teams?.length ? "selected" : "all",
      teams: (criterion?.teams || []).map(String),
      type: criterion?.type || "manual",
      weightage: criterion?.weightage ?? 0,
      metric: criterion?.metric || "",
      scoringMethod: criterion?.scoringMethod || "rating",
      isActive: criterion?.isActive ?? true,
      params: { ...(criterion?.params || {}) },
      ratingOptions: criterion?.ratingOptions?.length ? criterion.ratingOptions : DEFAULT_RATINGS,
      bands: criterion?.params?.bands || [],
      scope: criterion?.departments?.length ? "selected" : "all",
      departments: (criterion?.departments || []).map(String),
      deptWeights: Object.fromEntries(
        (criterion?.departmentWeightages || []).map((o) => [`d_${o.department}`, o.weightage])
      ),
    });
  }, [open, criterion, reset]);

  const type = useWatch({ control, name: "type" });
  const method = useWatch({ control, name: "scoringMethod" });
  const scope = useWatch({ control, name: "scope" });
  const selectedDepts = useWatch({ control, name: "departments" });
  const defaultWeight = useWatch({ control, name: "weightage" });
  const parentId = useWatch({ control, name: "parentCriterion" });
  const positionsScope = useWatch({ control, name: "positionsScope" });
  const selectedPositions = useWatch({ control, name: "positions" }) || [];
  const teamsScope = useWatch({ control, name: "teamsScope" });
  const selectedTeams = useWatch({ control, name: "teams" }) || [];

  const { data: allTeams = [] } = useQuery({ queryKey: ["teams"], queryFn: fetchTeams, enabled: open });
  // Teams on offer follow the department choice.
  const teamOptions =
    scope === "selected"
      ? allTeams.filter((t) => (selectedDepts || []).includes(String(t.department?._id || t.department)))
      : allTeams;
  const deptNameById = new Map(departments.map((d) => [String(d._id), d.name]));
  const toggleTeam = (id, checked) =>
    setValue("teams", checked ? [...selectedTeams, id] : selectedTeams.filter((t) => t !== id), { shouldValidate: true });

  const weightDepts =
    scope === "selected"
      ? departments.filter((d) => (selectedDepts || []).includes(String(d._id)))
      : departments;
  const methods = type === "manual" ? ["rating"] : (catalog?.scoringMethods || []).filter((m) => m !== "rating");

  // Top level criteria available to be selected as parent
  const potentialParents = (criteria || []).filter(
    (c) => !c.parentCriterion && String(c._id) !== String(criterion?._id)
  );

  // Live weightage calculations
  const weightVal = Number(defaultWeight) || 0;
  const siblings = (criteria || []).filter((c) => {
    if (String(c._id) === String(criterion?._id)) return false;
    if (!c.isActive) return false;
    if (parentId) {
      return String(c.parentCriterion?._id || c.parentCriterion) === String(parentId);
    }
    return !c.parentCriterion;
  });
  const siblingsTotal = siblings.reduce((sum, c) => sum + Number(c.weightage || 0), 0);
  const projectedTotal = Math.round((siblingsTotal + weightVal) * 100) / 100;
  const remaining = Math.round((100 - projectedTotal) * 100) / 100;

  useEffect(() => {
    if (type === "manual" && method !== "rating") setValue("scoringMethod", "rating");
    if (type && type !== "manual" && method === "rating") setValue("scoringMethod", "ratio");
  }, [type, method, setValue]);

  const togglePosition = (pos) => {
    if (selectedPositions.includes(pos)) {
      setValue("positions", selectedPositions.filter((p) => p !== pos));
    } else {
      setValue("positions", [...selectedPositions, pos]);
    }
  };

  const save = useMutation({
    onMutate: () => setError(""),
    mutationFn: (v) => {
      const params = { ...v.params };
      if (v.scoringMethod === "bands") params.bands = v.bands;
      const payload = {
        name: v.name,
        description: v.description,
        parentCriterion: v.parentCriterion || null,
        frequency: v.frequency || "monthly",
        scoreFromSubCriteria: Boolean(v.scoreFromSubCriteria),
        positions: v.positionsScope === "selected" ? v.positions : [],
        // Drop teams outside the chosen departments (e.g. a department was unticked).
        teams: v.teamsScope === "selected" ? v.teams.filter((id) => teamOptions.some((t) => String(t._id) === id)) : [],
        type: v.type,
        weightage: v.weightage,
        metric: v.type === "manual" ? null : v.metric,
        scoringMethod: v.type === "manual" ? "rating" : v.scoringMethod,
        params: v.type === "manual" ? {} : params,
        ratingOptions: v.type === "manual" ? v.ratingOptions : [],
        isActive: v.isActive,
        departments: v.scope === "selected" ? v.departments : [],
        departmentWeightages: Object.entries(v.deptWeights || {})
          .filter(([, w]) => w !== "" && w !== null && w !== undefined)
          .map(([k, w]) => ({ department: k.slice(2), weightage: Number(w) })),
      };
      return isEdit ? updateCriterion({ id: criterion._id, ...payload }) : createCriterion(payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["appraisal-settings"] });
      queryClient.invalidateQueries({ queryKey: ["appraisals"] });
      if (res.data?.weightage?.valid === false) toast.info(res.message);
      else toast.success(isEdit ? "Criterion updated" : "Criterion created");
      onClose();
    },
    onError: (e) => setError(apiError(e)),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${criterion.name}` : "Add criterion"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={handleSubmit((v) => save.mutate(v))}>
            {isEdit ? "Save changes" : "Add criterion"}
          </Button>
        </>
      }
    >
      <form className="space-y-5" noValidate>
        {error && (
          <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {/* Criterion Structure & Hierarchy */}
        <div className="rounded-card border border-border/80 bg-background/50 p-4 space-y-4">
          <p className="text-xs uppercase tracking-wide font-semibold text-muted">1. Structure & Hierarchy</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Criterion hierarchy" {...register("parentCriterion")}>
              <option value="">Main Criterion (Top-level)</option>
              {potentialParents.map((p) => (
                <option key={p._id} value={p._id}>
                  Sub-criterion of: {p.name}
                </option>
              ))}
            </Select>

            <Select label="Evaluation frequency" error={errors.frequency?.message} {...register("frequency")}>
              {FREQUENCIES.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          {!parentId && (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" className="rounded border-border" {...register("scoreFromSubCriteria")} />
              <span>Calculate main criterion score as weighted average of its sub-criteria</span>
            </label>
          )}
        </div>

        {/* Basic Information */}
        <div className="space-y-4">
          <Input label="Name / Title" error={errors.name?.message} {...register("name")} />
          <Textarea label="Description / Instructions" rows={2} {...register("description")} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select label="Type" {...register("type")}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>

            <div>
              <Input
                label="Percentage Weight (%)"
                type="number"
                step="0.01"
                min="0"
                max="100"
                error={errors.weightage?.message}
                {...register("weightage")}
              />
            </div>

            <Select label="Status" {...register("isActive", { setValueAs: (v) => v === true || v === "true" })}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </div>

          {parentId && (() => {
            const parent = (criteria || []).find((c) => String(c._id) === String(parentId));
            if (!parent) return null;
            const all = projectedTotal || 0;
            const pts = all > 0 ? Math.round(((Number(parent.weightage) * weightVal) / all) * 100) / 100 : 0;
            return (
              <p className="text-xs text-muted">
                Sub-criteria share <strong className="text-foreground">{parent.name}</strong>&apos;s {parent.weightage} points in
                proportion to their weightage; the main criterion&apos;s score is the sum of theirs. This one is worth{" "}
                <strong className="text-foreground">{pts} pts</strong>.
              </p>
            );
          })()}

          {/* Live Weightage Feedback */}
          <div className="rounded-input border border-border/60 bg-surface/50 p-3 text-xs flex items-center justify-between">
            <div>
              <span className="text-muted">
                {parentId ? "Sub-criteria total under parent:" : "Top-level criteria total:"}
              </span>{" "}
              <strong className="text-foreground">{projectedTotal}%</strong>
            </div>
            {projectedTotal === 100 ? (
              <span className="flex items-center gap-1 font-medium text-success">
                <CheckCircle size={14} /> Exactly 100% (Balanced)
              </span>
            ) : remaining > 0 ? (
              <span className="flex items-center gap-1 font-medium text-warning">
                <AlertTriangle size={14} /> {remaining}% remaining to reach 100%
              </span>
            ) : (
              <span className="flex items-center gap-1 font-medium text-danger">
                <AlertTriangle size={14} /> {Math.abs(remaining)}% excess (exceeds 100%)
              </span>
            )}
          </div>
        </div>

        {/* Department and Position Assignment */}
        <div className="rounded-card border border-border/80 bg-background/50 p-4 space-y-4">
          <p className="text-xs uppercase tracking-wide font-semibold text-muted">2. Department, Team & Position Assignment</p>

          <Controller
            name="departments"
            control={control}
            render={({ field }) => (
              <DepartmentPicker
                scope={scope}
                onScopeChange={(s) => setValue("scope", s)}
                value={field.value || []}
                onChange={field.onChange}
                departments={departments}
                error={errors.departments?.message}
              />
            )}
          />

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Team assignment</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={teamsScope === "all"} onChange={() => setValue("teamsScope", "all")} />
                <span>All teams</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={teamsScope === "selected"} onChange={() => setValue("teamsScope", "selected")} />
                <span>Selected teams only</span>
              </label>
            </div>
            {teamsScope === "selected" && (
              <div className="grid grid-cols-1 gap-2 rounded-btn border border-border bg-background p-3 sm:grid-cols-2">
                {teamOptions.length === 0 && (
                  <p className="text-sm text-muted">
                    {scope === "selected" ? "No teams in the selected departments." : "No teams exist yet."}
                  </p>
                )}
                {teamOptions.map((t) => (
                  <label key={t._id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedTeams.includes(String(t._id))}
                      onChange={(e) => toggleTeam(String(t._id), e.target.checked)}
                    />
                    <span className="truncate">
                      {t.name}
                      <span className="text-muted"> · {deptNameById.get(String(t.department?._id || t.department)) || t.department?.name || "—"}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {errors.teams?.message && <p className="text-sm text-danger">{errors.teams.message}</p>}
          </fieldset>

          <div className="space-y-2">
            <label className="text-sm font-medium">Position Assignment (base permission level)</label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="positionsScope"
                  value="all"
                  checked={positionsScope === "all"}
                  onChange={() => setValue("positionsScope", "all")}
                />
                <span>All positions in department</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="positionsScope"
                  value="selected"
                  checked={positionsScope === "selected"}
                  onChange={() => setValue("positionsScope", "selected")}
                />
                <span>Specific positions</span>
              </label>
            </div>

            {positionsScope === "selected" && (
              <div className="mt-2 space-y-2 rounded-card border border-border bg-surface p-3">
                <p className="text-xs text-muted">Select positions that this criterion applies to:</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(POSITION_LABELS).map(([pos, label]) => {
                    const isSelected = selectedPositions.includes(pos);
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => togglePosition(pos)}
                        className={`rounded-btn px-2.5 py-1 text-xs font-medium transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-background hover:bg-surface text-muted"
                        }`}
                      >
                        {label} {isSelected ? "✓" : "+"}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Department Weightage Overrides */}
        {weightDepts.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Department weightage overrides</legend>
            <p className="text-xs text-muted">
              Leave blank to use the default ({defaultWeight || 0}%).
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {weightDepts.map((d) => (
                <label key={d._id} className="flex items-center justify-between gap-3 rounded-btn border border-border px-3 py-2 text-sm">
                  <span className="truncate">{d.name}</span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder={String(defaultWeight ?? "")}
                      aria-label={`${d.name} weightage`}
                      {...register(`deptWeights.d_${d._id}`)}
                      className="w-20 rounded-input border border-border bg-surface px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-primary"
                    />
                    <span className="text-muted">%</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {/* Metric and Scoring Method (for automatic/hybrid) */}
        {type !== "manual" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Data source / metric" error={errors.metric?.message} {...register("metric")}>
              <option value="">Select…</option>
              {Object.entries(catalog?.metrics || {}).map(([k, m]) => (
                <option key={k} value={k}>
                  {m.label}
                </option>
              ))}
            </Select>
            <Select label="Scoring method" {...register("scoringMethod")}>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
          </div>
        )}

        {type !== "manual" && method === "target" && (
          <Input label="Target value (= 100%)" type="number" step="any" {...register("params.target")} />
        )}
        {type !== "manual" && method === "deduction" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="% lost per unit" type="number" step="0.01" {...register("params.unitPct")} />
            <Input label="Free units" type="number" step="any" {...register("params.freeUnits")} />
            <Input label="Minimum % (floor)" type="number" step="0.01" {...register("params.floorPct")} />
          </div>
        )}
        {type !== "manual" && method === "bands" && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Bands (metric range → performance %)</p>
            {bands.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                <Input label="Min" type="number" step="any" {...register(`bands.${i}.min`)} />
                <Input label="Max (blank = ∞)" type="number" step="any" {...register(`bands.${i}.max`)} />
                <Input label="%" type="number" step="0.01" {...register(`bands.${i}.pct`)} />
                <Button variant="ghost" type="button" aria-label="Remove band" onClick={() => bands.remove(i)}>
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
            <Button variant="secondary" type="button" onClick={() => bands.append({ min: 0, max: "", pct: 100 })}>
              <Plus size={15} /> Add band
            </Button>
          </div>
        )}
        {type !== "manual" && (
          <Input label="Performance % when no data (e.g. no tasks)" type="number" step="0.01" {...register("params.noDataPct")} />
        )}

        {/* Custom Rating Options for manual criteria if not using standard scale */}
        {type === "manual" && !parentId && (
          <div className="space-y-2 rounded-card border border-border/60 bg-surface/30 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Evaluation Rating Scale</p>
              <Badge value="Poor / Average / Good scale supported" />
            </div>
            <p className="text-xs text-muted">
              Evaluations default to Poor (25%), Average (50%), Good (100%). You can customize rating options below if desired:
            </p>
            {ratings.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
                <Input label="Label" error={errors.ratingOptions?.[i]?.label?.message} {...register(`ratingOptions.${i}.label`)} />
                <Input label="Score %" type="number" step="0.01" error={errors.ratingOptions?.[i]?.pct?.message} {...register(`ratingOptions.${i}.pct`)} />
                <Button variant="ghost" type="button" aria-label="Remove option" onClick={() => ratings.remove(i)}>
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
            <Button variant="secondary" type="button" size="sm" onClick={() => ratings.append({ label: "", pct: 0 })}>
              <Plus size={14} /> Add custom option
            </Button>
          </div>
        )}
      </form>
    </Dialog>
  );
}
