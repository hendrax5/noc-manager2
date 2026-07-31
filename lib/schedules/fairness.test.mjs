import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hoursPerShift,
  summaryColumns,
  isWorkingShiftName,
  computeIsLembur,
  buildPersonSummary,
  buildDeptSummaries,
} from "./fairness.js";

describe("hoursPerShift", () => {
  it("maps pola hours", () => {
    assert.equal(hoursPerShift("POLA_1"), 9);
    assert.equal(hoursPerShift("POLA_2"), 8);
    assert.equal(hoursPerShift("POLA_5"), 12);
    assert.equal(hoursPerShift("UNKNOWN"), 9);
  });
});

describe("computeIsLembur", () => {
  it("auto: working + generated OFF", () => {
    assert.equal(computeIsLembur({ shiftTypeId: 1, generatedShiftTypeId: null }), true);
  });
  it("auto: working + generated same work → false", () => {
    assert.equal(computeIsLembur({ shiftTypeId: 1, generatedShiftTypeId: 1 }), false);
  });
  it("auto: OFF → false", () => {
    assert.equal(computeIsLembur({ shiftTypeId: null, generatedShiftTypeId: null }), false);
  });
  it("explicit wins", () => {
    assert.equal(computeIsLembur({ shiftTypeId: 1, generatedShiftTypeId: null, explicit: false }), false);
    assert.equal(computeIsLembur({ shiftTypeId: 1, generatedShiftTypeId: 2, explicit: true }), true);
  });
});

describe("buildPersonSummary", () => {
  it("counts POLA_2 plain S1 vs OC and lembur", () => {
    const row = buildPersonSummary({
      pola: "POLA_2",
      user: { id: 1, name: "Ada", email: "a@x" },
      daysInMonth: 3,
      cells: [
        { shiftName: "S1", isLembur: false },
        { shiftName: "S1+OC", isLembur: false },
        { shiftName: "S2", isLembur: true },
      ],
    });
    assert.equal(row.plainS1, 1);
    assert.equal(row.oc, 1);
    assert.equal(row.s2, 1);
    assert.equal(row.lembur, 1);
    assert.equal(row.kerja, 3);
    assert.equal(row.totalHours, 24);
    assert.equal(row.off, 0);
  });
});
