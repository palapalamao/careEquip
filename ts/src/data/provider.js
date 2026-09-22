// F-A 接口实现（docs/plan/04-接口清单.md）：
//   I-R2 loadDeviceTimeline / I-R3 loadWorkOrders / I-R4 loadInspections
//   I-W1 createWorkOrder / I-W2 transitWorkOrder / I-W3 saveDeviceProfile / I-W4 createInspection
// demo = 本地模拟（内存存储，可增改状态）；fin = FIN 项目（读 readAll，写 lib 受控函数）。
import {
  createDataset,
  RECORDS_DATASET_ID,
  planSystemName,
  planExecResultName,
} from "./fixtures.js";
import {
  normalizeFinRows,
  normalizeHistoryRows,
  normalizeInspectionRows,
  normalizePlanRows,
  normalizePlanExecRows,
  normalizeReviewRows,
  normalizeUtilizationRows,
  normalizeWorkOrderRows,
  resolveProject,
  assertWoTransition,
  profilePatchOf,
} from "./model.js";

let demoStore = null;
function getDemoStore() {
  if (!demoStore) demoStore = createDataset();
  return demoStore;
}
const nowIso = () => new Date().toISOString();

async function finClient(signal) {
  const project = hostProject();
  if (!project)
    throw new Error("未识别到 FIN 项目。请从 FIN End User 的设备管理入口打开。");
  const { Client } = await import("haystack-nclient");
  return new Client({
    base: new URL(window.location.href),
    project,
    options: { headers: { accept: "text/zinc" }, signal },
  });
}
async function finEval(expression, signal) {
  const client = await finClient(signal);
  const grid = await client.ext.eval(expression);
  signal?.throwIfAborted();
  return grid.toJSON().rows || [];
}
// Axon 字面量：date / dateTime 以带引号 ISO 字符串发送（与 seed v2 一致；
// 本 FIN 的 Axon 解析器不接受裸日期时间字面量）。number/bool 原样，字符串转义。
function axonValue(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "object" && v.__dmAxonRef) return v.__dmAxonRef;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") return axonDict(v);
  return `"${String(v).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
function axonDict(payload) {
  const entries = Object.entries(payload)
    .map(([k, v]) => {
      const lit = axonValue(v);
      return lit === null ? null : `${k}: ${lit}`;
    })
    .filter(Boolean);
  if (!entries.length) throw new Error("没有可写入的有效字段");
  return `{${entries.join(", ")}}`;
}
const refOf = (deviceId) => `@${deviceId.replace(/^@/, "")}`;
// Axon 引用值：以 @p:...:r:... 裸引用发送。后端按 Ref 接收（dmCreateWorkOrder/
// dmCreateInspection），若带引号成字符串会被后端安全转型为 null 而报 "dmDeviceRef is required"。
const axonRef = (id) => ({ __dmAxonRef: refOf(id) });

export function hostProject() {
  let shell;
  try {
    shell =
      window.top?.finstack?.projectName ??
      window.top?.fin5Top?.finstack?.projectName;
  } catch {
    /* Cross-origin hosts require explicit project context. */
  }
  return resolveProject({
    shell,
    query: new URLSearchParams(window.location.search).get("project"),
    dev: import.meta.env.VITE_FIN_PROJECT,
    isDev: import.meta.env.DEV,
  });
}
export async function loadDataset(mode, signal) {
  if (mode === "demo") return getDemoStore();
  const rows = await finEval(
    "readAll(dmDevice and dmSynthetic, {limit:1000})",
    signal,
  );
  if (rows.length >= 1000)
    throw new Error(
      "模拟记录达到 1000 条读取上限，请缩小数据集后再查看，避免显示不完整汇总。",
    );
  return normalizeFinRows(rows);
}

async function finDevicesById(signal) {
  const deviceRows = await finEval("readAll(dmDevice, {limit:1000})", signal);
  return new Map(normalizeFinRows(deviceRows).devices.map((d) => [d.id, d]));
}

// I-R3 工单列表
export async function loadWorkOrders(mode, signal) {
  if (mode === "demo") return [...getDemoStore().workOrders];
  const devicesById = await finDevicesById(signal);
  const rows = await finEval("readAll(dmWorkOrder, {limit:1000})", signal);
  return normalizeWorkOrderRows(rows, devicesById);
}
// I-R4 检测记录列表
export async function loadInspections(mode, signal) {
  if (mode === "demo") return [...getDemoStore().inspections];
  const devicesById = await finDevicesById(signal);
  const rows = await finEval("readAll(dmInspection, {limit:1000})", signal);
  return normalizeInspectionRows(rows, devicesById);
}
// I-R2 设备关联记录（前端用 buildDeviceTimeline 合并）
export async function loadDeviceRecords(mode, deviceId, signal) {
  if (mode === "demo") {
    const store = getDemoStore();
    return {
      workOrders: store.workOrders.filter((w) => w.deviceId === deviceId),
      inspections: store.inspections.filter((i) => i.deviceId === deviceId),
    };
  }
  const ref = refOf(deviceId);
  const [workOrders, inspections] = await Promise.all([
    finEval(`readAll(dmWorkOrder and dmDeviceRef==${ref}, {limit:1000})`, signal),
    finEval(`readAll(dmInspection and dmDeviceRef==${ref}, {limit:1000})`, signal),
  ]);
  const devicesById = new Map([[deviceId, { id: deviceId }]]);
  return {
    workOrders: normalizeWorkOrderRows(workOrders, devicesById),
    inspections: normalizeInspectionRows(inspections, devicesById),
  };
}

// I-W1 新建工单
export async function createWorkOrder(mode, payload) {
  const { deviceId, type, assignee, scheduled, content } = payload;
  if (!deviceId) throw new Error("必须关联设备");
  if (!content?.trim()) throw new Error("工单内容不能为空");
  if (mode === "demo") {
    const store = getDemoStore();
    const device = store.devices.find((d) => d.id === deviceId);
    if (!device) throw new Error(`设备不存在：${deviceId}`);
    const order = {
      id: `dm-local-wo-${String(store.workOrders.length + 1).padStart(3, "0")}`,
      deviceId,
      deviceCode: device.code,
      deviceName: device.name,
      module: device.module,
      type: type || "maintenance",
      typeName: type || "maintenance",
      status: "open",
      assignee: assignee?.trim() || "未指派",
      scheduled: scheduled || null,
      started: null,
      closed: null,
      content: content.trim(),
      result: "",
      createdAt: nowIso(),
      createdBy: "local-demo",
      dataset: RECORDS_DATASET_ID,
      source: "synthetic",
    };
    store.workOrders = [order, ...store.workOrders];
    return { id: order.id };
  }
  const rows = await finEval(
    `dmCreateWorkOrder(${axonDict({
      dmDeviceRef: axonRef(deviceId),
      dmWoType: type || "maintenance",
      dmWoAssignee: assignee?.trim() || "未指派",
      dmWoScheduled: scheduled || undefined,
      dmWoContent: content.trim(),
      dmDataset: RECORDS_DATASET_ID,
    })})`,
  );
  return { id: rows[0]?.id ?? null };
}
// I-W2 工单状态迁移（open→inProgress→closed）
export async function transitWorkOrder(mode, id, target, note = "") {
  if (mode === "demo") {
    const store = getDemoStore();
    const order = store.workOrders.find((w) => w.id === id);
    if (!order) throw new Error(`工单不存在：${id}`);
    if (target === "closed" && !(note || "").trim())
      throw new Error("关闭工单必须填写执行结果（dmWoResult 必填）");
    assertWoTransition(order.status, target);
    store.workOrders = store.workOrders.map((w) => {
      if (w.id !== id) return w;
      const next = { ...w, status: target };
      if (target === "inProgress") next.started = nowIso();
      if (target === "closed") {
        next.closed = nowIso();
        next.result = note || w.result;
      }
      return next;
    });
    return { id };
  }
  await finEval(`dmTransitWorkOrder(${refOf(id)}, "${target}", ${axonValue(note) || '""'})`);
  return { id };
}
// I-W3 补充档案（仅空→有）
export async function saveDeviceProfile(mode, deviceId, patch) {
  if (mode === "demo") {
    const store = getDemoStore();
    const device = store.devices.find((d) => d.id === deviceId);
    if (!device) throw new Error(`设备不存在：${deviceId}`);
    const applicable = profilePatchOf(device, patch);
    if (!Object.keys(applicable).length)
      throw new Error("没有可补充的档案字段（仅允许补充空缺字段）");
    if (applicable.commissionDate) device.commissionDate = applicable.commissionDate;
    if (applicable.inServiceDate) device.inServiceDate = applicable.inServiceDate;
    if (applicable.acceptanceDocUri) {
      const doc = {
        id: `dm-local-doc-${String(store.docs.length + 1).padStart(3, "0")}`,
        type: "acceptance",
        typeName: "acceptance",
        date: applicable.commissionDate || nowIso().slice(0, 10),
        uri: applicable.acceptanceDocUri,
        deviceId,
        provenance: "local demo",
        source: "synthetic",
      };
      store.docs = [...store.docs, doc];
      device.acceptanceDocId = doc.id;
    }
    return { id: deviceId };
  }
  await finEval(
    `dmSaveDeviceProfile(${refOf(deviceId)}, ${axonDict({
      dmCommissionDate: patch.commissionDate || undefined,
      dmInServiceDate: patch.inServiceDate || undefined,
      dmDocUri: patch.acceptanceDocUri || undefined,
    })})`,
  );
  return { id: deviceId };
}
// I-W4 新建检测记录
export async function createInspection(mode, payload) {
  const { target, result, date, note, reportUri, deviceId } = payload;
  if (!target) throw new Error("必须选择检测对象");
  if (!date) throw new Error("必须选择检测日期");
  if (mode === "demo") {
    const store = getDemoStore();
    const device = deviceId ? store.devices.find((d) => d.id === deviceId) : null;
    if (deviceId && !device) throw new Error(`设备不存在：${deviceId}`);
    const record = {
      id: `dm-local-insp-${String(store.inspections.length + 1).padStart(3, "0")}`,
      deviceId: device?.id || null,
      deviceCode: device?.code || "—",
      deviceName: device?.name || "全院",
      module: device?.module || "unclassified",
      target,
      targetName: target,
      result: result || "pass",
      date,
      note: note?.trim() || "",
      reportUri: reportUri?.trim() || "",
      createdAt: nowIso(),
      createdBy: "local-demo",
      dataset: RECORDS_DATASET_ID,
      source: "synthetic",
    };
    store.inspections = [record, ...store.inspections];
    return { id: record.id };
  }
  const rows = await finEval(
    `dmCreateInspection(${axonDict({
      dmInspectTarget: target,
      dmInspectResult: result || "pass",
      dmInspectDate: date,
      dmInspectNote: note?.trim() || undefined,
      dmReportUri: reportUri?.trim() || undefined,
      dmDeviceRef: deviceId ? axonRef(deviceId) : undefined,
      dmDataset: RECORDS_DATASET_ID,
    })})`,
  );
  return { id: rows[0]?.id ?? null };
}

export async function loadHistory(pointId, signal) {
  if (!/^p:[a-zA-Z0-9_-]+:r:dm-demo-[a-z0-9-]+$/.test(pointId))
    throw new Error("无效的模拟历史点位标识");
  const project = hostProject();
  if (!project || !pointId.startsWith(`p:${project}:r:`)) throw new Error("历史点位不属于当前项目");
  const { Client } = await import("haystack-nclient");
  signal?.throwIfAborted();
  const client = new Client({base:new URL(window.location.href),project,options:{headers:{accept:"text/zinc"},signal}});
  const grid = await client.ext.eval(`readById(@${pointId}).hisRead((now() - 24hr)..now())`);
  signal?.throwIfAborted();
  return normalizeHistoryRows(grid.toJSON().rows || []);
}


// I-R11 计划与执行记录
export async function loadPlans(mode, signal) {
  if (mode === "demo") {
    const store = getDemoStore();
    return {
      plans: [...store.plans],
      planExecs: [...store.planExecs],
      reviews: [...(store.reviews || [])],
    };
  }
  const [planRows, execRows, reviewRows] = await Promise.all([
    finEval("readAll(dmPlan, {limit:1000})", signal),
    finEval("readAll(dmPlanExec, {limit:1000})", signal),
    finEval("readAll(dmPlanReviewRec, {limit:1000})", signal),
  ]);
  const plans = normalizePlanRows(planRows);
  const plansById = new Map(plans.map((p) => [p.id, p]));
  return {
    plans,
    planExecs: normalizePlanExecRows(execRows, plansById),
    reviews: normalizeReviewRows(reviewRows),
  };
}

// I-W10 保存年度考核结论（同一 system+year 覆盖更新）
export async function savePlanReview(mode, payload) {
  const { system, year, summary, conclusion } = payload;
  if (!system) throw new Error("必须选择系统");
  if (!/^\d{4}$/.test(year || "")) throw new Error("考核年度格式应为 YYYY");
  if (!conclusion) throw new Error("必须给出考核结论");
  if (mode === "demo") {
    const store = getDemoStore();
    if (!store.reviews) store.reviews = [];
    const idx = store.reviews.findIndex(
      (r) => r.system === system && r.year === year,
    );
    const rec = {
      id: idx >= 0 ? store.reviews[idx].id : `dm-local-review-${system}-${year}`,
      system,
      systemName: planSystemName(system),
      year,
      summary: { ...summary },
      conclusion,
      savedAt: nowIso(),
      savedBy: "本地演示用户",
      source: "synthetic",
    };
    if (idx >= 0) store.reviews[idx] = rec;
    else store.reviews.push(rec);
    return { id: rec.id };
  }
  await finEval(
    `dmSavePlanReview(${axonDict({
      dmReviewSystem: system,
      dmReviewYear: year,
      dmReviewSummary: summary,
      dmReviewConclusion: conclusion,
    })})`,
  );
  return { id: `${system}-${year}` };
}

// I-W8 新建运行计划（同系统同周期拒绝重复）
export async function createPlan(mode, payload) {
  const { system, period, content } = payload;
  if (!system) throw new Error("必须选择系统");
  if (!/^\d{4}-\d{2}$/.test(period || "")) throw new Error("周期格式应为 YYYY-MM");
  if (!content?.trim()) throw new Error("必须填写计划内容");
  if (mode === "demo") {
    const store = getDemoStore();
    if (store.plans.some((p) => p.system === system && p.period === period))
      throw new Error("该系统该周期已有计划");
    const plan = {
      id: `dm-local-plan-${String(store.plans.length + 1).padStart(3, "0")}`,
      system,
      systemName: planSystemName(system),
      period,
      content: content.trim(),
      createdAt: nowIso(),
      createdBy: "local-demo",
      dataset: RECORDS_DATASET_ID,
      source: "synthetic",
    };
    store.plans = [plan, ...store.plans];
    return { id: plan.id };
  }
  await finEval(
    `dmCreatePlan(${axonDict({
      dmPlanSystem: system,
      dmPlanPeriod: period,
      dmPlanContent: content.trim(),
      dmDataset: RECORDS_DATASET_ID,
    })})`,
  );
  return { id: null };
}

// I-W8 执行登记（校验计划存在与结果枚举）
export async function recordPlanExec(mode, payload) {
  const { planId, date, result, note } = payload;
  if (!planId) throw new Error("必须选择计划");
  if (!date) throw new Error("必须选择执行日期");
  if (!["done", "partial", "missed"].includes(result))
    throw new Error("执行结果必须为 完成/部分完成/未完成");
  if (mode === "demo") {
    const store = getDemoStore();
    const plan = store.plans.find((p) => p.id === planId);
    if (!plan) throw new Error(`计划不存在：${planId}`);
    const exec = {
      id: `dm-local-exec-${String(store.planExecs.length + 1).padStart(3, "0")}`,
      planId,
      date,
      result,
      resultName: planExecResultName(result),
      note: note?.trim() || "",
      createdAt: nowIso(),
      createdBy: "local-demo",
      dataset: RECORDS_DATASET_ID,
      source: "synthetic",
    };
    store.planExecs = [exec, ...store.planExecs];
    return { id: exec.id };
  }
  await finEval(
    `dmRecordPlanExec(${axonDict({
      dmPlanRef: axonRef(planId),
      dmExecDate: date,
      dmExecResult: result,
      dmExecNote: note?.trim() || undefined,
      dmDataset: RECORDS_DATASET_ID,
    })})`,
  );
  return { id: null };
}

// ===== F-D 数据分析接口（docs/plan/04-接口清单.md）=====

// I-R14 设备利用率聚合：FIN 走 lib 只读函数；demo 读 fixtures 确定性生成器
export async function loadUtilization(mode, days, signal) {
  if (![7, 30, 90].includes(days)) throw new Error("统计窗口必须为 7/30/90 天");
  if (mode === "demo") {
    const { buildDemoUtilization } = await import("./fixtures.js");
    return buildDemoUtilization(getDemoStore().devices, days);
  }
  const rows = await finEval(`dmComputeUtilization(${days})`, signal);
  return normalizeUtilizationRows(rows);
}

// I-W12 演示历史种子（FIN 专用；demo 为本地生成无需种子）
export async function seedSyntheticHistory(mode) {
  if (mode === "demo") return { seeded: 0, skipped: 0, demo: true };
  const rows = await finEval("dmSeedSyntheticHistory()");
  const r = rows[0] || {};
  const get = (k) => (r[k] && typeof r[k] === "object" ? r[k].val ?? r[k].value : r[k]);
  return { seeded: Number(get("seeded")) || 0, skipped: Number(get("skipped")) || 0 };
}

// I-W11 演示成本回填（FIN 专用；demo 由确定性规则实时推导）
export async function backfillSyntheticCosts(mode) {
  if (mode === "demo") return { workOrders: 0, devices: 0, demo: true };
  const rows = await finEval("dmBackfillSyntheticCosts()");
  const r = rows[0] || {};
  const get = (k) => (r[k] && typeof r[k] === "object" ? r[k].val ?? r[k].value : r[k]);
  return {
    workOrders: Number(get("dmWorkOrder")) || 0,
    devices: Number(get("dmDevice")) || 0,
  };
}
