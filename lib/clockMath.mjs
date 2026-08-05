// Pure math for ClockPicker's analog face — no React/DOM, so it's trivially
// unit-checkable on its own (see scripts/check-clock-math.mjs). Both faces
// (hour: 1-12, minute: 00/05/.../55) use the same 12 marks 30deg apart, 0deg
// at the top, clockwise — so hour and minute share one angle→index step.

export const angleFromPoint = (clientX, clientY, rect) => {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let deg = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI + 90;
  if (deg < 0) deg += 360;
  return deg;
};

const angleToMarkIndex = (deg) => Math.round(deg / 30) % 12;

export const angleToHour12 = (deg) => {
  const idx = angleToMarkIndex(deg);
  return idx === 0 ? 12 : idx;
};

export const angleToMinute5 = (deg) => angleToMarkIndex(deg) * 5;

export const markPosition = (index, center, radius) => {
  const rad = (index * 30 * Math.PI) / 180;
  return { x: center + radius * Math.sin(rad), y: center - radius * Math.cos(rad) };
};

export const parseTimeValue = (value) => {
  if (!value) return { hour12: 12, minute: 0, period: "AM" };
  const [hStr, mStr] = value.split(":");
  const h24 = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);
  const period = h24 >= 12 ? "PM" : "AM";
  const hour12raw = h24 % 12;
  return { hour12: hour12raw === 0 ? 12 : hour12raw, minute, period };
};

export const formatTimeValue = ({ hour12, minute, period }) => {
  const pad = (n) => String(n).padStart(2, "0");
  const h24 = (hour12 % 12) + (period === "PM" ? 12 : 0);
  return `${pad(h24)}:${pad(minute)}`;
};

export const formatDisplay = ({ hour12, minute, period }) => `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
