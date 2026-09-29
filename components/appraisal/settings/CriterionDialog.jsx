"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";

import Dialog from "@/components/ui/Dialog";
import { Button, Input, Select, Textarea } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { createCriterion, updateCriterion } from "@/services/appraisalsService";
import { METHOD_LABELS, TYPE_LABELS, apiError } from "@/lib/appraisal";

const num = () => yup.number().transform((v, o) => (o === "" || o === null ? undefined : v));
const schema = yup.object({
  name: yup.string().trim().required("Name is required"),
  description: yup.string(),
  type: yup.string().required(),
  weightage: num().required("Weightage is required").min(0).max(100),
  metric: yup.string().when("type", { is: (t) => t !== "manual", then: (s) => s.required("Choose a data source") }),
  scoringMethod: yup.string().required(),
  isActive: yup.boolean(),
  params: yup.object({ target: num(), unitPct: num().min(0), freeUnits: num().min(0), floorPct: num().min(0).max(100), noDataPct: num().min(0).max(100) }),
  ratingOptions: yup.array().of(yup.object({ label: yup.string().trim().required("Label required"), pct: num().required("% required").min(0).max(100) })),
  bands: yup.array().of(yup.object({ min: num().required(), max: num(), pct: num().required().min(0).max(100) })),
});

const DEFAULT_RATINGS = [
  { label: "Poor", pct: 33.33 },
  { label: "Average", pct: 66.67 },
  { label: "Excellent", pct: 100 },
];

// Add/edit a criterion's *definition*. Weightage/activation changes that
// would break the 100% total are rejected by the server — the "Adjust
// weightage" dialog is the way to rebalance several at once.
export default function CriterionDialog({ open, onClose: onCloseProp, criterion, catalog }) {
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
      type: criterion?.type || "manual",
      weightage: criterion?.weightage ?? 0,
      metric: criterion?.metric || "",
      scoringMethod: criterion?.scoringMethod || "rating",
      isActive: criterion?.isActive ?? false,
      params: { ...(criterion?.params || {}) },
      ratingOptions: criterion?.ratingOptions?.length ? criterion.ratingOptions : DEFAULT_RATINGS,
      bands: criterion?.params?.bands || [],
    });
  }, [open, criterion, reset]);

  const type = useWatch({ control, name: "type" });
  const method = useWatch({ control, name: "scoringMethod" });
  const methods = type === "manual" ? ["rating"] : (catalog?.scoringMethods || []).filter((m) => m !== "rating");

  // Keep the method valid for the type: manual is always "rating"; the
  // others can't use it.
  useEffect(() => {
    if (type === "manual" && method !== "rating") setValue("scoringMethod", "rating");
    if (type && type !== "manual" && method === "rating") setValue("scoringMethod", "ratio");
  }, [type, method, setValue]);

  const save = useMutation({
    onMutate: () => setError(""),
    mutationFn: (v) => {
      const params = { ...v.params };
      if (v.scoringMethod === "bands") params.bands = v.bands;
      const payload = {
        name: v.name,
        description: v.description,
        type: v.type,
        weightage: v.weightage,
        metric: v.type === "manual" ? null : v.metric,
        scoringMethod: v.type === "manual" ? "rating" : v.scoringMethod,
        params: v.type === "manual" ? {} : params,
        ratingOptions: v.type === "manual" ? v.ratingOptions : [],
        isActive: v.isActive,
      };
      return isEdit ? updateCriterion({ id: criterion._id, ...payload }) : createCriterion(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appraisal-settings"] });
      toast.success(isEdit ? "Criterion updated" : "Criterion created");
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
      <form className="space-y-4" noValidate>
        {error && (
          <p role="alert" className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Input label="Name" error={errors.name?.message} {...register("name")} />
        <Textarea label="Description" rows={2} {...register("description")} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select label="Type" {...register("type")}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Input label="Weightage (%)" type="number" step="0.01" error={errors.weightage?.message} {...register("weightage")} />
          <Select label="Status" {...register("isActive", { setValueAs: (v) => v === true || v === "true" })}>
            <option value="false">Inactive</option>
            <option value="true">Active</option>
          </Select>
        </div>

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

        {type !== "manual" && method === "target" && <Input label="Target value (= 100%)" type="number" step="any" {...register("params.target")} />}
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
        {type !== "manual" && <Input label="Performance % when there's no data (e.g. no tasks)" type="number" step="0.01" {...register("params.noDataPct")} />}

        {type === "manual" && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Rating options</p>
            {ratings.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
                <Input label="Label" error={errors.ratingOptions?.[i]?.label?.message} {...register(`ratingOptions.${i}.label`)} />
                <Input label="Score %" type="number" step="0.01" error={errors.ratingOptions?.[i]?.pct?.message} {...register(`ratingOptions.${i}.pct`)} />
                <Button variant="ghost" type="button" aria-label="Remove option" onClick={() => ratings.remove(i)}>
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
            <Button variant="secondary" type="button" onClick={() => ratings.append({ label: "", pct: 0 })}>
              <Plus size={15} /> Add option
            </Button>
          </div>
        )}
      </form>
    </Dialog>
  );
}
