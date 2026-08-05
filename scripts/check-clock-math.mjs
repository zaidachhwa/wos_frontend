import assert from "node:assert";

import { angleToHour12, angleToMinute5, parseTimeValue, formatTimeValue } from "../lib/clockMath.mjs";

assert.equal(angleToHour12(0), 12, "0deg is 12 o'clock");
assert.equal(angleToHour12(29), 1, "just under 30deg rounds to 1");
assert.equal(angleToHour12(90), 3, "90deg is 3 o'clock");
assert.equal(angleToHour12(345), 12, "wraps back to 12 near 360deg");

assert.equal(angleToMinute5(0), 0);
assert.equal(angleToMinute5(180), 30, "180deg is the 30-minute mark");
assert.equal(angleToMinute5(354), 0, "wraps back to 0 near 360deg");

assert.deepEqual(parseTimeValue("14:30"), { hour12: 2, minute: 30, period: "PM" });
assert.deepEqual(parseTimeValue("00:05"), { hour12: 12, minute: 5, period: "AM" });
assert.deepEqual(parseTimeValue("12:00"), { hour12: 12, minute: 0, period: "PM" });
assert.deepEqual(parseTimeValue(""), { hour12: 12, minute: 0, period: "AM" });

assert.equal(formatTimeValue({ hour12: 2, minute: 30, period: "PM" }), "14:30");
assert.equal(formatTimeValue({ hour12: 12, minute: 0, period: "AM" }), "00:00");
assert.equal(formatTimeValue({ hour12: 12, minute: 0, period: "PM" }), "12:00");

// Round-trip every value the picker can actually produce (12 hours x AM/PM x
// 5-minute marks) through parse -> format and back to itself.
for (let hour12 = 1; hour12 <= 12; hour12++) {
  for (const period of ["AM", "PM"]) {
    for (let minute = 0; minute < 60; minute += 5) {
      const value = formatTimeValue({ hour12, minute, period });
      assert.equal(formatTimeValue(parseTimeValue(value)), value, `round-trip ${value}`);
    }
  }
}

console.log("check-clock-math: all checks passed");
