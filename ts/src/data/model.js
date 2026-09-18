// F-A: FIN 行归一化扩展（I-R1 档案字段 / I-R2 时间线 / I-R3 工单 / I-R4 检测）
import {
  PLAN_SYSTEMS,
  planSystemName,
  planExecResultName,
} from "./fixtures.js";
const unwrap = (v) =>
  v && typeof v === "object" ? (v.val ?? v.value ?? null) : v;

export function filterDevices(devices, filters = {}) {
  const search = (filters.search || "").trim().toLocaleLowerCase();
  return devices.filter(
    (d) =>
      (!search ||
        [d.name, d.code, d.type, d.location].some((v) =>
          String(v || "")
            .toLocaleLowerCase()
            .includes(search),
        )) &&
      (!filters.module ||
        filters.module === "all" ||
        d.module === filters.module) &&
      (!filters.floor ||
        filters.floor === "all" ||
        d.floor === filters.floor) &&
      (!filters.status ||
        filters.status === "all" ||
        d.status === filters.status),
  );
}
export function summarize(devices) {
  const unknown = devices.filter((d) => d.status === "unknown").length;
  const attention = devices.filter((d) =>
    ["fault", "offline"].includes(d.status),
  ).length;
  return {
    total: devices.length,
    healthy: devices.length - unknown - attention,
    attention,
    unknown,
    running: devices.filter((d) => d.status === "running").length,
    offline: devices.filter((d) => d.status === "offline").length,
    points: devices.reduce((sum, d) => sum + d.points.length, 0),
  };
}
export function normalizeFinRows(rows) {
  const devices = rows.map((row) => {
    const get = (key) => unwrap(row[key]);
    const number = get("dmValue");
    const synthetic =
      row.dmSynthetic === true || row.dmSynthetic?._kind === "marker";
    const quality = ["fresh", "stale", "unknown"].includes(get("dmQuality"))
      ? get("dmQuality")
      : "unknown";
    return {
      id: get("id") || "",
      code: get("dmCode") || "—",
      name: get("dis") || "未命名设备",
      module: get("dmModule") || "unclassified",
      type: get("dmType") || "未分类",
      site: get("dmSite") || "未配置",
      floor: get("dmFloor") || "未配置",
      location:
        [get("dmSite"), get("dmFloor")].filter(Boolean).join(" / ") || "未配置",
      status: ["running", "stopped", "fault", "offline", "unknown"].includes(
        get("dmStatus"),
      )
        ? get("dmStatus")
        : "unknown",
      quality,
      source: synthetic ? "synthetic" : "unknown",
      dataset: get("dmDataset") || "unknown",
      updatedAt: get("dmUpdatedAt") || null,
      historyPointId: get("dmPrimaryPointRef") || null,
      manufacturer: get("dmManufacturer") || "未配置",
      model: get("dmModel") || "未配置",
      // F-A I-R1：档案扩展字段（无值保留空，不伪造）
      commissionDate: get("dmCommissionDate") || null,
      inServiceDate: get("dmInServiceDate") || null,
      acceptanceDocId: get("dmAcceptanceDocRef") || null,
      points: [
        {
          id: `${get("id")}-value`,
          name: get("dmMetric") || "模拟读数",
          value:
            typeof number === "number" && Number.isFinite(number)
              ? number
              : null,
          unit: get("dmUnit") || "",
          quality,
        },
      ],
      trend: [],
    };
  });
  return {
    devices,
    alarms: devices
      .filter((d) => ["fault", "offline"].includes(d.status))
      .map((d) => ({
        id: `alarm-${d.id}`,
        deviceId: d.id,
        name: d.name,
        code: d.code,
        module: d.module,
        severity: d.status === "fault" ? "critical" : "warning",
        status: "active",
        message: d.status === "fault" ? "模拟设备故障" : "模拟通信离线",
        ts: d.updatedAt,
        source: d.source,
      })),
    source: devices.every((d) => d.source === "synthetic")
      ? "synthetic"
      : "unknown",
    dataset: "FIN 项目记录",
    updatedAt: null,
  };
}

// F-A I-R3/I-R4：工单与检测记录的 FIN 行归一化
export function normalizeWorkOrderRows(rows, devicesById = new Map()) {
  return rows
    .map((row) => {
      const get = (key) => unwrap(row[key]);
      const deviceId = get("dmDeviceRef") || "";
      const device = devicesById.get(deviceId) || {};
      const synthetic =
        row.dmSynthetic === true || row.dmSynthetic?._kind === "marker";
      return {
        id: get("id") || "",
        deviceId,
        deviceCode: device.code || "—",
        deviceName: device.name || "未关联设备",
        module: device.module || "unclassified",
        type: get("dmWoType") || "maintenance",
        typeName: get("dmWoType") || "maintenance",
        status: get("dmWoStatus") || "open",
        assignee: get("dmWoAssignee") || "未指派",
        scheduled: get("dmWoScheduled") || null,
        started: get("dmWoStarted") || null,
        closed: get("dmWoClosed") || null,
        content: get("dmWoContent") || "",
        result: get("dmWoResult") || "",
        createdAt: get("dmCreatedAt") || get("dmWoScheduled") || null,
        createdBy: get("dmCreatedBy") || "unknown",
        dataset: get("dmDataset") || "unknown",
        source: synthetic ? "synthetic" : "unknown",
      };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
export function normalizeInspectionRows(rows, devicesById = new Map()) {
  return rows
    .map((row) => {
      const get = (key) => unwrap(row[key]);
      const deviceId = get("dmDeviceRef") || null;
      const device = (deviceId && devicesById.get(deviceId)) || {};
      const synthetic =
        row.dmSynthetic === true || row.dmSynthetic?._kind === "marker";
      return {
        id: get("id") || "",
        deviceId,
        deviceCode: device.code || "—",
        deviceName: device.name || "全院",
        module: device.module || "unclassified",
        target: get("dmInspectTarget") || "other",
        targetName: get("dmInspectTarget") || "other",
        result: get("dmInspectResult") || "pass",
        date: get("dmInspectDate") || null,
        note: get("dmInspectNote") || "",
        reportUri: get("dmReportUri") || "",
        createdAt: get("dmCreatedAt") || null,
        createdBy: get("dmCreatedBy") || "unknown",
        dataset: get("dmDataset") || "unknown",
        source: synthetic ? "synthetic" : "unknown",
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

// F-A I-R2：设备关联记录时间线（工单 + 检测，按时间倒序）
export function buildDeviceTimeline(deviceId, workOrders, inspections) {
  const items = [
    ...workOrders
      .filter((w) => w.deviceId === deviceId)
      .map((w) => ({
        kind: "workOrder",
        ts: w.started || w.scheduled || w.createdAt,
        title: `工单 · ${w.typeName || w.type}`,
        status: w.status,
        detail: w.content,
        refId: w.id,
      })),
    ...inspections
      .filter((i) => i.deviceId === deviceId)
      .map((i) => ({
        kind: "inspection",
        ts: i.date,
        title: `检测 · ${i.targetName || i.target}`,
        status: i.result === "pass" ? "closed" : "attention",
        detail: i.note,
        refId: i.id,
      })),
  ];
  return items.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
}

// F-A I-W2：工单状态机（open→inProgress→closed 单向；与 lib Fantom 实现保持一致）
export const WO_TRANSITIONS = { open: ["inProgress"], inProgress: ["closed"], closed: [] };
export function assertWoTransition(current, target) {
  if (!WO_TRANSITIONS[current]) throw new Error(`未知工单状态：${current}`);
  if (!WO_TRANSITIONS[current].includes(target))
    throw new Error(`非法状态迁移：${current} → ${target}`);
}

// F-A I-W3：档案补充仅允许空→有（不覆盖既有值）
export function profilePatchOf(device, patch) {
  const out = {};
  for (const key of ["commissionDate", "inServiceDate"]) {
    if (patch[key] && !device[key]) out[key] = patch[key];
  }
  if (patch.acceptanceDocUri && !device.acceptanceDocId)
    out.acceptanceDocUri = patch.acceptanceDocUri;
  return out;
}

export function normalizeHistoryRows(rows) {
  return rows.map(row => ({ ts: unwrap(row.ts), value: unwrap(row.v0 ?? row.val) }))
    .filter(row => Number.isFinite(Date.parse(row.ts)) && typeof row.value === "number" && Number.isFinite(row.value))
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
}
export function resolveProject({ shell, query, dev, isDev = false } = {}) {
  const candidate = shell || query || (isDev ? dev : "") || "";
  return /^[a-zA-Z0-9_-]+$/.test(candidate) ? candidate : "";
}
export function toCsv(devices) {
  const safe = (value) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const rows = [
    [
      "设备编码",
      "设备名称",
      "系统",
      "位置",
      "状态",
      "数据质量",
      "来源",
      "快照时间",
    ],
    ...devices.map((d) => [
      d.code,
      d.name,
      d.module,
      d.location,
      d.status,
      d.quality,
      d.source === "synthetic" ? "Synthetic / 模拟数据" : "Unknown / 未知来源",
      d.updatedAt,
    ]),
  ];
  return "﻿" + rows.map((row) => row.map(safe).join(",")).join("\r\n");
}

// F-A：工单 / 检测 CSV 导出（R2.3 留痕导出）
export function workOrdersToCsv(rows) {
  const safe = (value) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const head = ["工单号", "设备编码", "设备名称", "类型", "状态", "执行人", "计划时间", "开始时间", "关闭时间", "内容", "结果", "来源"];
  const body = rows.map((w) => [
    w.id, w.deviceCode, w.deviceName, w.type, w.status, w.assignee,
    w.scheduled, w.started, w.closed, w.content, w.result,
    w.source === "synthetic" ? "Synthetic / 模拟数据" : "Unknown / 未知来源",
  ]);
  return "﻿" + [head, ...body].map((r) => r.map(safe).join(",")).join("\r\n");
}
export function inspectionsToCsv(rows) {
  const safe = (value) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const head = ["记录号", "检测对象", "结论", "日期", "设备编码", "设备名称", "说明", "报告", "来源"];
  const body = rows.map((i) => [
    i.id, i.target, i.result, i.date, i.deviceCode, i.deviceName,
    i.note, i.reportUri,
    i.source === "synthetic" ? "Synthetic / 模拟数据" : "Unknown / 未知来源",
  ]);
  return "﻿" + [head, ...body].map((r) => r.map(safe).join(",")).join("\r\n");
}

// ============ F-C I-R11：运行计划 / 执行登记归一化 + 年度考核（9.2.6）============
export function normalizePlanRows(rows) {
  return rows
    .map((row) => {
      const get = (key) => unwrap(row[key]);
      const synthetic =
        row.dmSynthetic === true || row.dmSynthetic?._kind === "marker";
      const system = get("dmPlanSystem") || "";
      return {
        id: get("id") || "",
        system,
        systemName: planSystemName(system),
        period: get("dmPlanPeriod") || "",
        content: get("dmPlanContent") || "",
        createdAt: get("dmCreatedAt") || null,
        createdBy: get("dmCreatedBy") || "unknown",
        dataset: get("dmDataset") || "unknown",
        source: synthetic ? "synthetic" : "unknown",
      };
    })
    .sort((a, b) => String(b.period).localeCompare(String(a.period)));
}
export function normalizePlanExecRows(rows, plansById = new Map()) {
  return rows
    .map((row) => {
      const get = (key) => unwrap(row[key]);
      const synthetic =
        row.dmSynthetic === true || row.dmSynthetic?._kind === "marker";
      const planId = get("dmPlanRef") || "";
      const plan = plansById.get(planId) || {};
      const result = get("dmExecResult") || "done";
      return {
        id: get("id") || "",
        planId,
        system: plan.system || "",
        systemName: plan.systemName || planSystemName(plan.system || ""),
        period: plan.period || "",
        date: get("dmExecDate") || null,
        result,
        resultName: planExecResultName(result),
        note: get("dmExecNote") || "",
        createdAt: get("dmCreatedAt") || null,
        createdBy: get("dmCreatedBy") || "unknown",
        dataset: get("dmDataset") || "unknown",
        source: synthetic ? "synthetic" : "unknown",
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}


// F-C I-R13：年度考核结论记录归一化（dmPlanReviewRec，v0.3.2 落库）
export function normalizeReviewRows(rows) {
  return rows
    .map((row) => {
      const get = (key) => unwrap(row[key]);
      const synthetic =
        row.dmSynthetic === true || row.dmSynthetic?._kind === "marker";
      const system = get("dmReviewSystem") || "";
      const summary = row.dmReviewSummary || {};
      const unwrapNum = (v) => {
        const x = unwrap(v);
        return typeof x === "number" ? x : Number(x ?? 0) || 0;
      };
      const total = unwrapNum(summary.total);
      const done = unwrapNum(summary.done);
      return {
        id: get("id") || "",
        system,
        systemName: planSystemName(system),
        year: get("dmReviewYear") || "",
        summary: {
          total,
          done,
          partial: unwrapNum(summary.partial),
          missed: unwrapNum(summary.missed),
          unregistered: unwrapNum(summary.unregistered),
          completionRate:
            summary.completionRate != null && summary.completionRate !== ""
              ? Number(summary.completionRate)
              : total ? Math.round((done / total) * 100) : null,
        },
        conclusion: get("dmReviewConclusion") || "",
        savedAt: get("dmReviewSavedAt") || null,
        savedBy: get("dmReviewSavedBy") || "unknown",
        source: synthetic ? "synthetic" : "unknown",
      };
    })
    .sort((a, b) => String(b.year).localeCompare(String(a.year)) || a.system.localeCompare(b.system));
}

// F-C R-C.3：年度考核——按系统汇总计划执行情况，给出结论（不写回记录，可导出）
// 口径：应执行=该年计划数；无登记的计划计未登记；完成率=完成/应执行
export function buildAnnualReview(plans, planExecs, year) {
  const yearPlans = plans.filter((p) => String(p.period).startsWith(String(year)));
  const execCountByPlan = new Map();
  for (const e of planExecs) {
    if (!String(e.period).startsWith(String(year))) continue;
    execCountByPlan.set(e.planId, (execCountByPlan.get(e.planId) || 0) + 1);
  }
  return PLAN_SYSTEMS.map((system) => {
    const sysPlans = yearPlans.filter((p) => p.system === system.id);
    const sysExecs = planExecs.filter(
      (e) => e.system === system.id && String(e.period).startsWith(String(year)),
    );
    const done = sysExecs.filter((e) => e.result === "done").length;
    const partial = sysExecs.filter((e) => e.result === "partial").length;
    const missed = sysExecs.filter((e) => e.result === "missed").length;
    const unregistered = sysPlans.filter((p) => !execCountByPlan.has(p.id)).length;
    const total = sysPlans.length;
    const completionRate = total ? Math.round((done / total) * 100) : null;
    const conclusion =
      total === 0 ? "未制定计划" :
      completionRate >= 90 ? "优秀" :
      completionRate >= 75 ? "合格" :
      completionRate >= 60 ? "基本合格" : "不合格";
    return {
      system: system.id,
      systemName: system.name,
      year,
      total,
      done,
      partial,
      missed,
      unregistered,
      completionRate,
      conclusion,
    };
  });
}

// F-C R-C.1/R-C.2 导出：计划及执行登记
export function plansToCsv(plans, planExecs) {
  const safe = (value) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const execByPlan = new Map();
  for (const e of planExecs) {
    const list = execByPlan.get(e.planId) || [];
    list.push(`${e.date}:${e.resultName}${e.note ? "（" + e.note + "）" : ""}`);
    execByPlan.set(e.planId, list);
  }
  const rows = [
    ["计划ID", "系统", "周期", "计划内容", "执行登记"],
    ...plans.map((p) => [
      p.id, p.systemName, p.period, p.content, (execByPlan.get(p.id) || []).join("；") || "未登记",
    ]),
  ];
  return "﻿" + rows.map((r) => r.map(safe).join(",")).join("\r\n");
}
// F-C R-C.3 导出：年度考核汇总
export function annualReviewToCsv(review) {
  const safe = (value) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const rows = [
    ["年度", "系统", "计划数(应执行)", "完成", "部分完成", "未完成", "未登记", "完成率(%)", "考核结论"],
    ...review.map((r) => [
      r.year, r.systemName, r.total, r.done, r.partial, r.missed, r.unregistered,
      r.completionRate ?? "—", r.conclusion,
    ]),
  ];
  return "﻿" + rows.map((r) => r.map(safe).join(",")).join("\r\n");
}
