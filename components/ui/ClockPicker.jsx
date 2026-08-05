"use client";

import { useState } from "react";
import { Clock } from "lucide-react";

import {
  angleFromPoint,
  angleToHour12,
  angleToMinute5,
  markPosition,
  parseTimeValue,
  formatTimeValue,
  formatDisplay,
} from "@/lib/clockMath.mjs";

const CENTER = 100;
const RADIUS = 76;

// Click-to-pick analog time picker: click an hour, the face swaps to
// minutes automatically, click a minute mark to finish. Value/onChange are
// a plain "HH:MM" 24h string, same as the native <input type="time"> it
// replaces, so callers don't need to know it's backed by an SVG clock.
export default function ClockPicker({ label, value, onChange, placeholder = "Select time…", disabled = false }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("hour");
  const { hour12, minute, period } = parseTimeValue(value);

  const commit = (patch) => onChange(formatTimeValue({ hour12, minute, period, ...patch }));

  const handleFaceClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const deg = angleFromPoint(e.clientX, e.clientY, rect);
    if (mode === "hour") {
      commit({ hour12: angleToHour12(deg) });
      setMode("minute");
    } else {
      commit({ minute: angleToMinute5(deg) });
    }
  };

  const marks = Array.from({ length: 12 }, (_, i) => {
    const { x, y } = markPosition(i, CENTER, RADIUS);
    const isSelected = mode === "hour" ? hour12 % 12 === i % 12 : Math.round(minute / 5) % 12 === i;
    return { key: i, x, y, isSelected, text: mode === "hour" ? (i === 0 ? 12 : i) : String((i * 5) % 60).padStart(2, "0") };
  });

  const handAngle = mode === "hour" ? (hour12 % 12) * 30 : minute * 6;
  const handRad = (handAngle * Math.PI) / 180;
  const handX = CENTER + (RADIUS - 4) * Math.sin(handRad);
  const handY = CENTER - (RADIUS - 4) * Math.cos(handRad);

  return (
    <div className="relative">
      {label && <label className="text-sm font-medium">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setMode("hour");
          setOpen((o) => !o);
        }}
        className={`mt-1 flex w-full items-center gap-2 rounded-input border border-border bg-surface px-3 py-2 text-left text-sm outline-none transition-colors duration-150 focus:border-primary disabled:opacity-50 ${
          value ? "" : "text-muted"
        }`}
      >
        <Clock size={14} className="shrink-0 text-muted" />
        <span className="flex-1 truncate">{value ? formatDisplay({ hour12, minute, period }) : placeholder}</span>
      </button>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute bottom-full left-0 z-40 mb-1 w-64 rounded-dropdown border border-border bg-surface p-4 shadow-md animate-[fadeIn_150ms_ease-out]">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-baseline gap-1 text-2xl font-semibold tabular-nums">
                <button
                  type="button"
                  onClick={() => setMode("hour")}
                  className={mode === "hour" ? "text-primary" : "text-muted"}
                >
                  {hour12}
                </button>
                <span className="text-muted">:</span>
                <button
                  type="button"
                  onClick={() => setMode("minute")}
                  className={mode === "minute" ? "text-primary" : "text-muted"}
                >
                  {String(minute).padStart(2, "0")}
                </button>
              </div>
              <div className="flex overflow-hidden rounded-btn border border-border text-xs font-medium">
                {["AM", "PM"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => commit({ period: p })}
                    className={`px-2 py-1 transition-colors duration-150 ${
                      period === p ? "bg-primary text-primary-foreground" : "text-muted hover:bg-background"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <svg viewBox="0 0 200 200" className="mx-auto block cursor-pointer touch-none" onClick={handleFaceClick}>
              <circle cx={CENTER} cy={CENTER} r={RADIUS + 16} className="fill-background" />
              <line x1={CENTER} y1={CENTER} x2={handX} y2={handY} className="stroke-primary" strokeWidth={2} />
              <circle cx={CENTER} cy={CENTER} r={3} className="fill-primary" />
              {marks.map((m) => (
                <g key={m.key}>
                  <circle cx={m.x} cy={m.y} r={14} className={m.isSelected ? "fill-primary" : "fill-transparent"} />
                  <text
                    x={m.x}
                    y={m.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={`select-none text-[13px] ${
                      m.isSelected ? "fill-primary-foreground font-semibold" : "fill-primary"
                    }`}
                  >
                    {m.text}
                  </text>
                </g>
              ))}
            </svg>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-btn bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
