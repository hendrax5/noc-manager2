import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STANDBY_HIGHLIGHT,
  STANDBY_NOTE,
  getRosterStatus,
  isAutoGenerateRunComplete,
  isManuallyProtectedCell,
  isRosterEligibleUser,
  partitionDepartmentMonthRows,
} from "./protection.js";
import { buildMonthDateRangeStrings, daysInCalendarMonth } from "./dates.js";

describe("isManuallyProtectedCell", () => {
  it("treats solver baseline and standby rows as unprotected", () => {
    assert.equal(
      isManuallyProtectedCell({
        shiftTypeId: 1,
        generatedShiftTypeId: 1,
        isLembur: false,
        manualEdited: false,
        highlightColor: null,
        note: null,
        noteUpdatedBy: null,
      }),
      false
    );
    assert.equal(
      isManuallyProtectedCell({
        shiftTypeId: 2,
        generatedShiftTypeId: 2,
        isLembur: false,
        manualEdited: false,
        highlightColor: STANDBY_HIGHLIGHT,
        note: STANDBY_NOTE,
        noteUpdatedBy: null,
      }),
      false
    );
  });

  it("protects manualEdited, isLembur, notes, highlights, and swapped shifts", () => {
    assert.equal(isManuallyProtectedCell({ manualEdited: true }), true);
    assert.equal(isManuallyProtectedCell({ isLembur: true }), true);
    assert.equal(isManuallyProtectedCell({ noteUpdatedBy: 4 }), true);
    assert.equal(isManuallyProtectedCell({ note: "Tukar dengan Andi" }), true);
    assert.equal(isManuallyProtectedCell({ highlightColor: "#fef08a" }), true);
    assert.equal(
      isManuallyProtectedCell({ shiftTypeId: 2, generatedShiftTypeId: 1 }),
      true
    );
  });
});

describe("partitionDepartmentMonthRows", () => {
  it("preserves manual cells and removes unedited cells of resigned users in preserve_manual mode", () => {
    const existingRows = [
      { id: 10, userId: 1, date: "2026-12-01", shiftTypeId: 1, generatedShiftTypeId: 1, manualEdited: false },
      { id: 11, userId: 1, date: "2026-12-02", shiftTypeId: 2, generatedShiftTypeId: 1, manualEdited: true, note: "Swap" },
      // Resigned user row (unedited) in month should be cleared
      { id: 12, userId: 99, date: "2026-12-01", shiftTypeId: 1, generatedShiftTypeId: 1, manualEdited: false },
    ];
    const generatedRows = [
      { userId: 1, date: new Date("2026-12-01T00:00:00.000Z"), shiftTypeId: 3, generatedShiftTypeId: 3 },
      { userId: 1, date: new Date("2026-12-02T00:00:00.000Z"), shiftTypeId: 1, generatedShiftTypeId: 1 },
    ];

    const out = partitionDepartmentMonthRows({
      existingRows,
      generatedRows,
      overwriteMode: "preserve_manual",
    });

    assert.deepEqual(out.deleteIds, [10, 12]);
    assert.equal(out.preservedCount, 1);
    assert.equal(out.creates.length, 1);
    assert.equal(out.creates[0].shiftTypeId, 3);
  });

  it("replaces everything when force_all is explicitly chosen", () => {
    const existingRows = [
      { id: 10, userId: 1, date: "2026-12-01", manualEdited: false },
      { id: 11, userId: 1, date: "2026-12-02", manualEdited: true, isLembur: true },
    ];
    const generatedRows = [
      { userId: 1, date: new Date("2026-12-01T00:00:00.000Z"), shiftTypeId: 1 },
      { userId: 1, date: new Date("2026-12-02T00:00:00.000Z"), shiftTypeId: 2 },
    ];

    const out = partitionDepartmentMonthRows({
      existingRows,
      generatedRows,
      overwriteMode: "force_all",
    });

    assert.deepEqual(out.deleteIds, [10, 11]);
    assert.equal(out.preservedCount, 0);
    assert.equal(out.creates.length, 2);
  });
});

describe("roster eligibility helpers", () => {
  it("excludes resigned, non-shift, Manager, and blank email users", () => {
    assert.equal(
      isRosterEligibleUser({ active: true, scheduleEligible: true, email: "a@noc.id", role: { name: "Staff" } }),
      true
    );
    assert.equal(
      isRosterEligibleUser({ active: false, scheduleEligible: true, email: "a@noc.id", role: { name: "Staff" } }),
      false
    );
    assert.equal(
      isRosterEligibleUser({ active: true, scheduleEligible: false, email: "a@noc.id", role: { name: "Staff" } }),
      false
    );
    assert.equal(
      isRosterEligibleUser({ active: true, scheduleEligible: true, email: "m@noc.id", role: { name: "Manager" } }),
      false
    );
    assert.equal(
      isRosterEligibleUser({ active: true, scheduleEligible: true, email: "   ", role: { name: "Staff" } }),
      false
    );

    assert.equal(getRosterStatus({ active: false }).code, "resigned");
    assert.equal(getRosterStatus({ active: true, role: { name: "Manager" } }).code, "non_shift_manager");
    assert.equal(getRosterStatus({ active: true, scheduleEligible: false }).code, "non_shift_manual");
    assert.equal(getRosterStatus({ active: true, scheduleEligible: true, email: "x@y.z" }).code, "eligible");
  });

  it("tracks auto-generate completion accurately", () => {
    assert.equal(isAutoGenerateRunComplete([{ ok: true }, { ok: true, skipped: true }]), true);
    assert.equal(isAutoGenerateRunComplete([{ ok: true }, { ok: false, error: "solver down" }]), false);
  });
});

describe("date range helpers", () => {
  it("builds timezone-independent YYYY-MM-DD bounds across leap years and Dec->Jan", () => {
    assert.equal(daysInCalendarMonth(2024, 2), 29);
    assert.equal(daysInCalendarMonth(2026, 2), 28);
    assert.deepEqual(buildMonthDateRangeStrings(2026, 12), {
      monthKey: "2026-12",
      startStr: "2026-12-01",
      endStr: "2026-12-31",
      nextStartStr: "2027-01-01",
    });
  });
});
