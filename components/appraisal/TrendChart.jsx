"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// "2026-09" -> "Sep ’26"
const shortMonth = (month) => {
  const [y, m] = month.split("-").map(Number);
  return `${new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })} ’${String(y).slice(2)}`;
};

// Finalized monthly scores over time, exactly as stored — history is never
// recalculated for display. Reference lines mark the classification cut-offs.
export default function TrendChart({ history, classifications = [] }) {
  const data = [...history]
    .filter((h) => h.status === "finalized")
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .map((h) => ({ month: shortMonth(h.month), score: Number(h.totalScore.toFixed(2)) }));

  if (data.length < 2) {
    return <p className="text-sm text-muted">The trend appears once there are at least two finalized months.</p>;
  }

  return (
    <div className="h-64 w-full" role="img" aria-label="Monthly appraisal score trend">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
          {classifications.slice(0, -1).map((c) => (
            <ReferenceLine key={c.key} y={c.max} stroke="var(--border)" strokeDasharray="4 4" />
          ))}
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
            formatter={(v) => [`${v} / 100`, "Score"]}
          />
          <Line type="monotone" dataKey="score" stroke="var(--info)" strokeWidth={2} dot={{ r: 3, fill: "var(--info)" }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
