// F-A: FIN 行归一化扩展（I-R1 档案字段 / I-R2 时间线 / I-R3 工单 / I-R4 检测）
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
