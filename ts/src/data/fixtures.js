// F-A: 设备档案与运维记录 —— 枚举与模拟数据集
// 枚举是前端、seed 脚本共用的唯一来源（见 docs/plan/03-数据结构.md）
export const MODULES = [
  { id: "hvac", name: "暖通空调", code: "AHU", type: "空气处理机组", unit: "°C", metric: "送风温度", base: 18 },
  { id: "power", name: "供配电", code: "PDB", type: "低压配电柜", unit: "kW", metric: "有功功率", base: 126 },
  { id: "water", name: "给排水", code: "PMP", type: "变频供水泵", unit: "bar", metric: "出口压力", base: 4.2 },
  { id: "lighting", name: "智能照明", code: "LGT", type: "照明控制箱", unit: "%", metric: "回路负载率", base: 65 },
  { id: "elevator", name: "电梯系统", code: "ELV", type: "医用电梯", unit: "%", metric: "载荷率", base: 32 },
  { id: "safety", name: "安全防范", code: "SEC", type: "安防监测设备", unit: "%", metric: "设备利用率", base: 46 },
  { id: "medical-space", name: "医疗空间", code: "OR", type: "洁净手术室", unit: "Pa", metric: "房间压差", base: 12 },
  { id: "medical-equipment", name: "医疗设备", code: "MED", type: "医疗设备监测终端", unit: "°C", metric: "设备温度", base: 26 },
];
export const SNAPSHOT_TIME = "2026-09-09T09:30:00+08:00";
export const DATASET_ID = "deviceManager-demo-v1";
// F-A 运维记录数据集（dmDoc / dmWorkOrder / dmInspection，add-only，见 seed-data-v2.mjs）
export const RECORDS_DATASET_ID = "deviceManager-demo-v2";

export const WO_TYPES = [
  { id: "maintenance", name: "日常维护" },
  { id: "repair", name: "维修" },
  { id: "retrofit", name: "改造" },
];
export const WO_STATUSES = [
  { id: "open", name: "待处理" },
  { id: "inProgress", name: "进行中" },
  { id: "closed", name: "已关闭" },
];
export const WO_TRANSITIONS = { open: ["inProgress"], inProgress: ["closed"], closed: [] };

export const INSPECT_TARGETS = [
  { id: "drinkingWater", name: "饮用水" },
  { id: "medicalWater", name: "医疗用水" },
  { id: "nonTraditionalWater", name: "非传统水源" },
  { id: "medicalGas", name: "医用气体" },
  { id: "hvac", name: "空调系统" },
  { id: "sewage", name: "污水处理" },
  { id: "medicalWaste", name: "医疗废物" },
  { id: "radiation", name: "射线防护" },
  { id: "indoorEnv", name: "室内环境" },
];
export const INSPECT_RESULTS = [
  { id: "pass", name: "达标" },
  { id: "fail", name: "不达标" },
];

export const DOC_TYPES = [
  { id: "acceptance", name: "验收资料" },
  { id: "manual", name: "设备手册" },
  { id: "testReport", name: "检测报告" },
  { id: "other", name: "其他" },
];

const woTypeName = (id) => WO_TYPES.find((t) => t.id === id)?.name || id;
const inspectTargetName = (id) => INSPECT_TARGETS.find((t) => t.id === id)?.name || id;
const docTypeName = (id) => DOC_TYPES.find((t) => t.id === id)?.name || id;
export { woTypeName, inspectTargetName, docTypeName };

export function createDataset() {
  const states = ["running", "running", "fault", "stopped", "offline", "unknown"];
  const devices = MODULES.flatMap((module, mi) =>
    Array.from({ length: 6 }, (_, i) => {
      const index = mi * 6 + i;
      const code = `${module.code}-${String(i + 1).padStart(3, "0")}`;
      const missing = i === 4 || i === 5;
      const value = missing ? null : Number((module.base + i * 0.7).toFixed(1));
      const quality = i === 4 ? "stale" : i === 5 ? "unknown" : "fresh";
      const id = `dm-demo-${code.toLowerCase()}`;
      return {
        id,
        code,
        name: `${module.name}${i + 1}号设备`,
        module: module.id,
        type: module.type,
        site: i < 3 ? "门诊综合楼" : "住院医技楼",
        floor: ["B1", "1F", "2F", "3F", "5F", "8F"][i],
        location: `${i < 3 ? "门诊综合楼" : "住院医技楼"} / ${["B1", "1F", "2F", "3F", "5F", "8F"][i]} / ${module.type}机房`,
        status: states[i],
        quality,
        source: "synthetic",
        dataset: DATASET_ID,
        updatedAt: SNAPSHOT_TIME,
        manufacturer: "演示设备厂商",
        model: `DEMO-${module.code}-2026`,
        // F-A R1.1 设备档案（模拟集全部预填；FIN 模式经 I-W3 补充，仅空→有）
        commissionDate: "2024-06-30",
        inServiceDate: "2024-09-01",
        acceptanceDocId: `dm-demo-doc-${code.toLowerCase()}-accept`,
        points: [
          { id: `dm-p-${index}-primary`, name: module.metric, value, unit: module.unit, quality },
          { id: `dm-p-${index}-run`, name: "运行反馈", value: missing ? null : states[i] === "running" ? 1 : 0, unit: "", quality },
          { id: `dm-p-${index}-hours`, name: "累计运行时间", value: missing ? null : 1200 + index * 17, unit: "h", quality },
        ],
        trend: missing
          ? []
          : Array.from({ length: 25 }, (_, h) => ({
              ts: new Date(Date.parse(SNAPSHOT_TIME) - (24 - h) * 3600000).toISOString(),
              value: Number((value + Math.sin((h + index) / 3) * module.base * 0.07).toFixed(2)),
            })),
      };
    }),
  );
  const alarms = devices
    .filter((d) => d.status === "fault" || d.status === "offline")
    .map((d) => ({
      id: `alarm-${d.id}`,
      deviceId: d.id,
      name: d.name,
      code: d.code,
      module: d.module,
      severity: d.status === "fault" ? "critical" : "warning",
      status: "active",
      message: d.status === "fault" ? "设备故障反馈，请检查运行状态" : "通信中断，当前读数不可用",
      ts: SNAPSHOT_TIME,
      source: "synthetic",
    }));
  return {
    devices,
    alarms,
    docs: createDemoDocs(devices),
    workOrders: createDemoWorkOrders(devices),
    inspections: createDemoInspections(devices),
    source: "synthetic",
    dataset: DATASET_ID,
    updatedAt: SNAPSHOT_TIME,
  };
}

// F-A R1.1：每台设备的验收资料档案
function createDemoDocs(devices) {
  return devices.map((d) => ({
    id: `dm-demo-doc-${d.code.toLowerCase()}-accept`,
    type: "acceptance",
    typeName: docTypeName("acceptance"),
    date: "2024-06-30",
    uri: `archives://${d.code}/acceptance-2024.pdf`,
    deviceId: d.id,
    provenance: "deviceManager seed v2",
    source: "synthetic",
  }));
}

// F-A R2.1：确定性模拟工单（状态迁移合法，引用闭合）
function createDemoWorkOrders(devices) {
  const byCode = (code) => devices.find((d) => d.code === code);
  const rows = [
    { code: "AHU-003", type: "repair", status: "closed", assignee: "王工", scheduled: "2026-08-02T09:00:00+08:00", started: "2026-08-02T09:30:00+08:00", closed: "2026-08-03T15:00:00+08:00", content: "送风温度异常，检查表冷器与传感器", result: "更换温度传感器，试运行正常" },
    { code: "PDB-001", type: "maintenance", status: "inProgress", assignee: "李工", scheduled: "2026-09-10T08:30:00+08:00", started: "2026-09-10T08:40:00+08:00", closed: null, content: "季度巡检：紧固端子、清扫柜体、红外测温", result: "" },
    { code: "PMP-002", type: "maintenance", status: "open", assignee: "赵工", scheduled: "2026-09-15T14:00:00+08:00", started: null, closed: null, content: "泵组例行保养：轴承润滑、机械密封检查", result: "" },
    { code: "OR-001", type: "retrofit", status: "open", assignee: "陈工", scheduled: "2026-10-08T10:00:00+08:00", started: null, closed: null, content: "手术室压差监测终端改造，更换为带报警输出型", result: "" },
  ];
  return rows.map((r, i) => {
    const device = byCode(r.code);
    return {
      id: `dm-demo-wo-${String(i + 1).padStart(3, "0")}`,
      deviceId: device.id,
      deviceCode: device.code,
      deviceName: device.name,
      module: device.module,
      type: r.type,
      typeName: woTypeName(r.type),
      status: r.status,
      assignee: r.assignee,
      scheduled: r.scheduled,
      started: r.started,
      closed: r.closed,
      content: r.content,
      result: r.result,
      createdAt: r.scheduled,
      createdBy: "system",
      dataset: RECORDS_DATASET_ID,
      source: "synthetic",
    };
  });
}

// F-A R2.2：确定性模拟定期检测记录（对应标准 9.1.2 检测对象）
function createDemoInspections(devices) {
  const byCode = (code) => devices.find((d) => d.code === code);
  const rows = [
    { code: "PMP-001", target: "drinkingWater", result: "pass", date: "2026-07-15", note: "生活水泵房出水浊度、余氯检测", reportUri: "reports://2026H1/drinking-water.pdf" },
    { code: "OR-001", target: "medicalGas", result: "pass", date: "2026-08-05", note: "手术室医用气体终端压力与纯度检测", reportUri: "reports://2026H1/medical-gas.pdf" },
    { code: "AHU-001", target: "hvac", result: "pass", date: "2026-08-20", note: "空调系统冷却水、冷冻水水质检测", reportUri: "reports://2026H1/hvac-water.pdf" },
    { code: "PMP-003", target: "sewage", result: "fail", date: "2026-09-01", note: "污水站出水 COD 超标，已转工单整改", reportUri: "reports://2026H1/sewage.pdf" },
    { code: null, target: "radiation", result: "pass", date: "2026-06-12", note: "放射科机房防护年度检测", reportUri: "reports://2026/radiation.pdf" },
  ];
  return rows.map((r, i) => {
    const device = r.code ? byCode(r.code) : null;
    return {
      id: `dm-demo-insp-${String(i + 1).padStart(3, "0")}`,
      deviceId: device?.id || null,
      deviceCode: device?.code || "—",
      deviceName: device?.name || "全院",
      module: device?.module || "unclassified",
      target: r.target,
      targetName: inspectTargetName(r.target),
      result: r.result,
      date: r.date,
      note: r.note,
      reportUri: r.reportUri,
      createdAt: `${r.date}T10:00:00+08:00`,
      createdBy: "system",
      dataset: RECORDS_DATASET_ID,
      source: "synthetic",
    };
  });
}
