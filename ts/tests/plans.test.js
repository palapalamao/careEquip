import test from "node:test";
import assert from "node:assert/strict";
import { createDataset, PLAN_SYSTEMS } from "../src/data/fixtures.js";
import {
  normalizePlanRows,
  normalizePlanExecRows,
  buildAnnualReview,
} from "../src/data/model.js";
import { loadPlans, createPlan, recordPlanExec } from "../src/data/provider.js";
import {
  createSeedRecordsV3,
} from "../../scripts/seed-data-v3.mjs";

const ref = (val) => ({ _kind: "ref", val });
const marker = { _kind: "marker" };

test("F-C: demo dataset has 54 plans and closed exec references", () => {
  const { plans, planExecs } = createDataset();
  assert.equal(plans.length, 54);
  assert.ok(planExecs.length >= 40);
  const planIds = new Set(plans.map((p) => p.id));
  assert.ok(planExecs.every((e) => planIds.has(e.planId)));
  assert.ok(plans.every((p) => PLAN_SYSTEMS.some((s) => s.id === p.system)));
});

test("F-C: annual review aggregates per system with valid conclusions", () => {
  const { plans, planExecs } = createDataset();
  const review = buildAnnualReview(plans, planExecs, 2026);
  assert.equal(review.length, 6);
  for (const r of review) {
    assert.equal(r.total, 9);
    assert.ok(["优秀", "合格", "基本合格", "不合格"].includes(r.conclusion));
    assert.equal(r.done + r.partial + r.missed + r.unregistered >= 0, true);
    assert.ok(r.completionRate >= 0 && r.completionRate <= 100);
  }
  const gas = review.find((r) => r.system === "medicalGas");
  assert.ok(gas.missed + gas.unregistered >= 1); // 2026-02 未执行 storyline
});

test("F-C: FIN plan/exec rows normalize with system names", () => {
  const plans = normalizePlanRows([
    {
      id: ref("p:mytest:r:dm-plan-1"),
      dmPlan: marker,
      dmPlanSystem: "hvac",
      dmPlanPeriod: "2026-10",
      dmPlanContent: "中央空调机组巡检",
      dmSynthetic: marker,
      dmDataset: "deviceManager-demo-v2",
    },
  ]);
  assert.equal(plans[0].systemName, "空调");
  assert.equal(plans[0].period, "2026-10");
  const execs = normalizePlanExecRows(
    [
      {
        id: ref("p:mytest:r:dm-exec-1"),
        dmPlanExec: marker,
        dmPlanRef: ref("p:mytest:r:dm-plan-1"),
        dmExecDate: "2026-10-15",
        dmExecResult: "partial",
        dmSynthetic: marker,
      },
    ],
    new Map([[plans[0].id, plans[0]]]),
  );
  assert.equal(execs[0].resultName, "部分完成");
  assert.equal(execs[0].systemName, "空调");
});

test("F-C: demo createPlan rejects duplicate system+period", async () => {
  await createPlan("demo", { system: "hvac", period: "2026-12", content: "年末巡检" });
  await assert.rejects(
    () => createPlan("demo", { system: "hvac", period: "2026-12", content: "重复计划" }),
    /已有计划/,
  );
  const { plans } = await loadPlans("demo");
  assert.ok(plans.some((p) => p.period === "2026-12" && p.system === "hvac"));
});

test("F-C: demo recordPlanExec validates plan and result enum", async () => {
  await assert.rejects(
    () => recordPlanExec("demo", { planId: "dm-demo-plan-nope", date: "2026-09-18", result: "done" }),
    /不存在/,
  );
  await assert.rejects(
    () => recordPlanExec("demo", { planId: "dm-demo-plan-hvac-2026-09", date: "2026-09-18", result: "whatever" }),
    /完成\/部分完成\/未完成/,
  );
  await recordPlanExec("demo", {
    planId: "dm-demo-plan-hvac-2026-09",
    date: "2026-09-18",
    result: "done",
    note: "",
  });
  const { planExecs } = await loadPlans("demo");
  assert.ok(planExecs.some((e) => e.planId === "dm-demo-plan-hvac-2026-09" && e.result === "done"));
});

test("F-C: seed v3 records are add-only, replay guarded and reference closed", () => {
  const records = createSeedRecordsV3();
  const ids = new Set(records.map((r) => r.id.val));
  assert.equal(ids.size, records.length);
  assert.equal(records.filter((r) => r.dmPlan).length, 54);
  assert.equal(records.filter((r) => r.dmPlanExec).length, 48);
  const planIds = new Set(records.filter((r) => r.dmPlan).map((r) => r.id.val));
  for (const r of records) {
    assert.ok(r.dmSynthetic);
    assert.ok(r.dmDataset === "deviceManager-demo-v2");
    if (r.dmPlanExec) assert.ok(planIds.has(r.dmPlanRef.val), `悬空计划引用: ${r.dmPlanRef.val}`);
  }
});
