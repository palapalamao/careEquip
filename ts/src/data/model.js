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
const unwrap = (v) =>
  v && typeof v === "object" ? (v.val ?? v.value ?? null) : v;
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
  return "\uFEFF" + rows.map((row) => row.map(safe).join(",")).join("\r\n");
}
