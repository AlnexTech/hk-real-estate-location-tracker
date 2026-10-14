import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_LAUNCH_TEMPLATE,
  inclusiveDuration,
  SPREADSHEET_LAUNCH_TASKS,
} from "./launch-template-data";
import {
  materializePlanTasks,
  openingDateAfterTaskEdit,
  openingDateFromDay0,
  planProgress,
} from "./launch-schedule";

describe("spreadsheet launch template", () => {
  it("has 50 tasks (sheet id 42 absent)", () => {
    assert.equal(SPREADSHEET_LAUNCH_TASKS.length, 50);
    assert.ok(!SPREADSHEET_LAUNCH_TASKS.some((t) => t.tid === "42"));
  });

  it("uses inclusive duration for every row", () => {
    for (const task of SPREADSHEET_LAUNCH_TASKS) {
      assert.equal(
        task.duration,
        inclusiveDuration(task.s, task.e),
        `tid ${task.tid}`,
      );
    }
  });

  it("materializes Day 0 = 2026-09-01 to sheet planned dates and opening", () => {
    const day0 = "2026-09-01";
    assert.equal(openingDateFromDay0(day0), "2027-05-29");

    const tasks = materializePlanTasks(day0, DEFAULT_LAUNCH_TEMPLATE.tasks);
    // Spot-check rows from the sheet for Day 0 = 1 Sep 2026
    const byTid = Object.fromEntries(tasks.map((t) => [t.tid, t]));
    assert.equal(byTid["1"].plannedStart, "2026-09-01");
    assert.equal(byTid["1"].plannedEnd, "2026-09-02");
    assert.equal(byTid["3"].plannedStart, "2026-09-01");
    assert.equal(byTid["4"].plannedStart, "2026-09-11");
    assert.equal(byTid["4"].plannedEnd, "2026-10-05");
    assert.equal(byTid["51"].plannedStart, "2027-05-29");
    assert.equal(byTid["51"].plannedEnd, "2027-05-29");
  });

  it("keeps opening date when a task planned date is edited", () => {
    const opening = "2027-05-29";
    const next = openingDateAfterTaskEdit(opening, {
      plannedStart: "2026-10-01",
      plannedEnd: "2026-10-15",
    });
    assert.equal(next, opening);
  });

  it("computes progress from Done tasks excluding N/A", () => {
    const pct = planProgress({
      tasks: [
        { status: "Done" },
        { status: "Done" },
        { status: "In Progress" },
        { status: "N/A" },
      ],
    });
    assert.equal(pct, 67);
  });
});
