"use client";

import { Search } from "lucide-react";

import { Input, Select } from "@/components/ui/Field";
import { STATUS_LABELS } from "@/lib/appraisal";

// Filter bar shared by the dashboard and reports. Department options come
// from the WOS Department entity — never a hard-coded list.
export default function AppraisalFilters({ filters, onChange, departments = [], designations = [], classifications = [], showStatus = true }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });
  return (
    <div className="grid grid-cols-2 gap-3 rounded-card border border-border bg-surface p-4 md:grid-cols-4 xl:grid-cols-7">
      <div className="relative col-span-2 md:col-span-4 xl:col-span-2">
        <Input label="Search employee" placeholder="Name, email or ID" value={filters.search || ""} onChange={set("search")} />
        <Search size={14} className="pointer-events-none absolute right-3 top-[34px] text-muted" />
      </div>
      <Select label="Department" value={filters.department || ""} onChange={set("department")}>
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d._id} value={d._id}>
            {d.name}
          </option>
        ))}
        <option value="unassigned">Unassigned</option>
      </Select>
      <Select label="Designation" value={filters.designation || ""} onChange={set("designation")}>
        <option value="">All designations</option>
        {designations.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>
      <Select label="Classification" value={filters.classification || ""} onChange={set("classification")}>
        <option value="">All</option>
        {classifications.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </Select>
      {showStatus && (
        <Select label="Status" value={filters.status || ""} onChange={set("status")}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Input label="Min score" type="number" min="0" max="100" value={filters.minScore || ""} onChange={set("minScore")} />
        <Input label="Max score" type="number" min="0" max="100" value={filters.maxScore || ""} onChange={set("maxScore")} />
      </div>
    </div>
  );
}
