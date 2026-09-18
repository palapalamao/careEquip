// F-A 接口实现（docs/plan/04-接口清单.md）：
//   I-R2 loadDeviceTimeline / I-R3 loadWorkOrders / I-R4 loadInspections
//   I-W1 createWorkOrder / I-W2 transitWorkOrder / I-W3 saveDeviceProfile / I-W4 createInspection
// demo = 本地模拟（内存存储，可增改状态）；fin = FIN 项目（读 readAll，写 lib 受控函数）。
import { createDataset, RECORDS_DATASET_ID } from "./fixtures";
import {
  normalizeFinRows,
  normalizeHistoryRows,
  normalizeInspectionRows,
  normalizeWorkOrderRows,
  resolveProject,
  assertWoTransition,
  profilePatchOf,
} from "./model";

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

