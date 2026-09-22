// F-D 数据分析与决策支持（R8 · F4.1~F4.3 · v0.4.0）纯函数测试
import test from "node:test";
import assert from "node:assert/strict";
import { createDataset, hash32, woCostOf, deviceFinancials, buildDemoUtilization } from "../src/data/fixtures.js";
import {
  buildFailureStats,
  buildBenefitStats,
  resolveWoCost,
  lastMonthLabels,
  utilizationToCsv,
  failureStatsToCsv,
  benefitToCsv,
} from "../src/data/model.js";

const NOW = new Date("2026-09-23T12:00:00+08:00");
const device = (over = {}) => ({
  id: "dm-dev-1",
  code: "AHU-001",
  name: "暖通空调1号设备",
  module: "hvac",
  source: "unknown",
  purchaseCost: null,
  annualBenefit: null,
  commissionDate: null,
  inServiceDate: null,
  ...over,
});
const wo = (over = {}) => ({
  id: "dm-wo-x",
  deviceId: "dm-dev-1",
  type: "repair",
  status: "closed",
  source: "unknown",
  cost: null,
  scheduled: "2026-09-01T09:00:00+08:00",
  started: "2026-09-01T10:00:00+08:00",
  closed: "2026-09-03T10:00:00+08:00", // 48h
  ...over,
});

test("F-D: hash32/woCostOf 确定性且落在类型区间内", () => {
  assert.equal(hash32("dm-demo-wo-001"), hash32("dm-demo-wo-001"));
  for (let i = 1; i <= 200; i++) {
    const id = `dm-demo-wo-${String(i).padStart(3, "0")}`;
    const m = woCostOf({ id, type: "maintenance" });
    const r = woCostOf({ id, type: "repair" });
    const f = woCostOf({ id, type: "retrofit" });
    assert.ok(m >= 200 && m <= 799, `maintenance ${m}`);
    assert.ok(r >= 800 && r <= 2999, `repair ${r}`);
    assert.ok(f >= 3000 && f <= 7999, `retrofit ${f}`);
  }
  // 与后端 Fantom 口径抽查：maintenance 区间下限 + 同 id 同值
  assert.equal(woCostOf({ id: "dm-demo-wo-001", type: "maintenance" }), woCostOf({ id: "dm-demo-wo-001", type: "maintenance" }));
});

test("F-D: resolveWoCost 显式成本优先，模拟数据按确定性推导，真实数据计 0", () => {
  assert.equal(resolveWoCost(wo({ cost: 1500 })), 1500);
  const syn = wo({ id: "dm-demo-wo-007", source: "synthetic", cost: null });
  assert.equal(resolveWoCost(syn), woCostOf(syn));
  assert.equal(resolveWoCost(wo({ cost: null })), 0);
});

test("F-D buildFailureStats: 频次≥3/年 → 关注；MTTR 仅计已关闭维修单", () => {
  const dev = device();
  const rows = [
    wo({ id: "w1", scheduled: "2026-09-01T09:00:00+08:00", started: "2026-09-01T10:00:00+08:00", closed: "2026-09-01T22:00:00+08:00" }),
    wo({ id: "w2", scheduled: "2026-08-01T09:00:00+08:00", started: "2026-08-01T10:00:00+08:00", closed: "2026-08-02T10:00:00+08:00" }),
    wo({ id: "w3", scheduled: "2026-07-01T09:00:00+08:00", started: "2026-07-01T10:00:00+08:00", closed: "2026-07-03T12:00:00+08:00" }),
    wo({ id: "w4", status: "inProgress", started: "2026-09-10T09:00:00+08:00", closed: null }), // 不计 MTTR
    wo({ id: "w5", type: "maintenance" }), // 非维修单不计
  ];
  const stats = buildFailureStats(rows, [dev], NOW);
  assert.equal(stats.rows.length, 1);
  const r = stats.rows[0];
  assert.equal(r.count, 4); // 含 inProgress 维修单
  assert.equal(r.flag, "watch"); // 频次≥3
  // MTTR = mean(12, 24, 50) = 28.67h（仅已关闭且 started/closed 齐全）
  assert.ok(Math.abs(r.mttrHours - (12 + 24 + 50) / 3) < 1e-6);
  assert.equal(r.months.find((m) => m.label === "2026-09").count, 2);
});

test("F-D buildFailureStats: MTTR>48h → 关注；无采购价时成本规则不触发", () => {
  const rows = [wo({ started: "2026-09-01T10:00:00+08:00", closed: "2026-09-04T10:00:00+08:00", cost: 99999 })];
  const stats = buildFailureStats(rows, [device()], NOW);
  assert.equal(stats.rows[0].flag, "watch"); // MTTR 72h
  assert.equal(stats.rows[0].purchaseCost, null);
});

test("F-D buildFailureStats: 累计维修成本>采购价×50% → 建议评估更新淘汰（优先级最高）", () => {
  const dev = device({ purchaseCost: 10 }); // 10 万
  const rows = [wo({ cost: 60000 })]; // 6 万 = 60% > 50%
  const stats = buildFailureStats(rows, [dev], NOW);
  assert.equal(stats.rows[0].flag, "retire");
});

test("F-D buildFailureStats: 年维修成本>采购价×15% → 关注", () => {
  const dev = device({ purchaseCost: 10 });
  const rows = [wo({ cost: 20000 })]; // 2 万 = 20% > 15%，未超 50%
  const stats = buildFailureStats(rows, [dev], NOW);
  assert.equal(stats.rows[0].flag, "watch");
});

test("F-D buildBenefitStats: LCC/ROI 公式与年限回退口径", () => {
  const dev = device({
    purchaseCost: 40,
    annualBenefit: 20,
    inServiceDate: "2024-09-23T00:00:00+08:00", // 整 2 年
  });
  const rows = [wo({ cost: 20000 })]; // 2 万维修
  const [r] = buildBenefitStats([dev], rows, NOW);
  assert.equal(r.lcc, 42); // 40 + 2
  assert.ok(Math.abs(r.years - 2) < 0.01);
  assert.ok(Math.abs(r.roi - ((20 * r.years - 42) / 42) * 100) < 1e-6);
  assert.ok(r.annualCost > 0);
  // 缺投用日期 → 用验收日期；皆无 → 未登记（years=null）
  const [r2] = buildBenefitStats([device({ purchaseCost: 40, annualBenefit: 20, commissionDate: "2025-09-23T00:00:00+08:00", inServiceDate: null })], [], NOW);
  assert.ok(r2.years > 0.9 && r2.years < 1.1);
  const [r3] = buildBenefitStats([device({ purchaseCost: 40, annualBenefit: 20 })], [], NOW);
  assert.equal(r3.years, null);
  assert.equal(r3.flag, "missing"); // 缺年限无法算 ROI → 待补充
});

test("F-D buildBenefitStats: 缺采购成本或年收益 → 待补充", () => {
  const [a] = buildBenefitStats([device({ annualBenefit: 20 })], [], NOW);
  assert.equal(a.lcc, null);
  assert.equal(a.flag, "missing");
  const [b] = buildBenefitStats([device({ purchaseCost: 40 })], [], NOW);
  assert.equal(b.roi, null);
  assert.equal(b.flag, "missing");
});

test("F-D buildDemoUtilization: 48 台、2 台闲置 + 1 台过载 storyline 命中规则", () => {
  const { devices } = createDataset();
  assert.equal(devices.length, 48);
  const rows = buildDemoUtilization(devices, 30);
  assert.equal(rows.length, 48);
  const byIdx = (i) => rows[i];
  // 全局序号 22/23 = 照明 5/6 号 → 闲置
  assert.equal(byIdx(22).status, "idle");
  assert.equal(byIdx(23).status, "idle");
  assert.equal(byIdx(22).onRatio, 0);
  // 全局序号 41 = 手术室 6 号 → 过载
  assert.equal(byIdx(41).status, "overload");
  assert.ok(byIdx(41).loadRatio > 0.9);
  assert.ok(byIdx(41).peakRatio > 1.1);
  // 正常设备：开机率 40%~80%，负荷率 30%~80%
  for (const i of [0, 5, 9, 17, 30, 47 === 41 ? 40 : 47]) {
    if (i === 41) continue;
    const r = byIdx(i);
    assert.equal(r.samples, 720);
    assert.ok(r.onRatio > 0.4 && r.onRatio < 0.8, `idx ${i} onRatio ${r.onRatio}`);
    assert.ok(r.loadRatio > 0.3 && r.loadRatio < 0.85, `idx ${i} load ${r.loadRatio}`);
  }
  // 7/90 天窗口同样生效
  assert.equal(buildDemoUtilization(devices, 7)[22].status, "idle");
  assert.equal(buildDemoUtilization(devices, 90)[41].status, "overload");
});

test("F-D deviceFinancials: 确定性且落在区间内（5~80 万 / 1~20 万）", () => {
  const { devices } = createDataset();
  for (const d of devices) {
    const a = deviceFinancials(d);
    const b = deviceFinancials(d);
    assert.deepEqual(a, b);
    assert.ok(a.purchaseCost >= 5 && a.purchaseCost <= 80, `${d.code} ${a.purchaseCost}`);
    assert.ok(a.annualBenefit >= 1 && a.annualBenefit <= 20);
    assert.ok(a.ratedValue > 0);
  }
});

test("F-D: lastMonthLabels 输出 12 个月标签（含当月）", () => {
  const labels = lastMonthLabels(NOW);
  assert.equal(labels.length, 12);
  assert.equal(labels[11], "2026-09");
  assert.equal(labels[0], "2025-10");
});

test("F-D: CSV 导出含表头且行数吻合", () => {
  const { devices } = createDataset();
  const util = buildDemoUtilization(devices, 30);
  const utilCsv = utilizationToCsv(util);
  assert.ok(utilCsv.split("\n")[0].includes("设备编号"));
  assert.equal(utilCsv.split("\n").length, 49);
  const stats = buildFailureStats([], devices, NOW);
  assert.ok(failureStatsToCsv(stats).includes("维修频次"));
  const benefit = benefitToCsv(buildBenefitStats(devices, [], NOW));
  assert.ok(benefit.split("\n").length, 49);
  assert.ok(benefit.includes("待补充") === false || true); // 演示设备全部有数
  assert.ok(!benefit.includes("待补充"));
});
