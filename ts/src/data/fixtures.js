export const MODULES = [
  {
    id: "hvac",
    name: "暖通空调",
    code: "AHU",
    type: "空气处理机组",
    unit: "°C",
    metric: "送风温度",
    base: 18,
  },
  {
    id: "power",
    name: "供配电",
    code: "PDB",
    type: "低压配电柜",
    unit: "kW",
    metric: "有功功率",
    base: 126,
  },
  {
    id: "water",
    name: "给排水",
    code: "PMP",
    type: "变频供水泵",
    unit: "bar",
    metric: "出口压力",
    base: 4.2,
  },
  {
    id: "lighting",
    name: "智能照明",
    code: "LGT",
    type: "照明控制箱",
    unit: "%",
    metric: "回路负载率",
    base: 65,
  },
  {
    id: "elevator",
    name: "电梯系统",
    code: "ELV",
    type: "医用电梯",
    unit: "%",
    metric: "载荷率",
    base: 32,
  },
  {
    id: "safety",
    name: "安全防范",
    code: "SEC",
    type: "安防监测设备",
    unit: "%",
    metric: "设备利用率",
    base: 46,
  },
  {
    id: "medical-space",
    name: "医疗空间",
    code: "OR",
    type: "洁净手术室",
    unit: "Pa",
    metric: "房间压差",
    base: 12,
  },
  {
    id: "medical-equipment",
    name: "医疗设备",
    code: "MED",
    type: "医疗设备监测终端",
    unit: "°C",
    metric: "设备温度",
    base: 26,
  },
];
export const SNAPSHOT_TIME = "2026-09-09T09:30:00+08:00";
export const DATASET_ID = "deviceManager-demo-v1";
export function createDataset() {
  const states = [
    "running",
    "running",
    "fault",
    "stopped",
    "offline",
    "unknown",
  ];
  const devices = MODULES.flatMap((module, mi) =>
    Array.from({ length: 6 }, (_, i) => {
      const index = mi * 6 + i;
      const code = `${module.code}-${String(i + 1).padStart(3, "0")}`;
      const missing = i === 4 || i === 5;
      const value = missing ? null : Number((module.base + i * 0.7).toFixed(1));
      const quality = i === 4 ? "stale" : i === 5 ? "unknown" : "fresh";
      return {
        id: `dm-demo-${code.toLowerCase()}`,
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
        points: [
          {
            id: `dm-p-${index}-primary`,
            name: module.metric,
            value,
            unit: module.unit,
            quality,
          },
          {
            id: `dm-p-${index}-run`,
            name: "运行反馈",
            value: missing ? null : states[i] === "running" ? 1 : 0,
            unit: "",
            quality,
          },
          {
            id: `dm-p-${index}-hours`,
            name: "累计运行时间",
            value: missing ? null : 1200 + index * 17,
            unit: "h",
            quality,
          },
        ],
        trend: missing
          ? []
          : Array.from({ length: 25 }, (_, h) => ({
              ts: new Date(
                Date.parse(SNAPSHOT_TIME) - (24 - h) * 3600000,
              ).toISOString(),
              value: Number(
                (
                  value +
                  Math.sin((h + index) / 3) * module.base * 0.07
                ).toFixed(2),
              ),
            })),
      };
    }),
  );
  const alarms = devices
    .filter((d) => d.status === "fault" || d.status === "offline")
    .map((d, i) => ({
      id: `alarm-${d.id}`,
      deviceId: d.id,
      name: d.name,
      code: d.code,
      module: d.module,
      severity: d.status === "fault" ? "critical" : "warning",
      status: "active",
      message:
        d.status === "fault"
          ? "设备故障反馈，请检查运行状态"
          : "通信中断，当前读数不可用",
      ts: SNAPSHOT_TIME,
      source: "synthetic",
    }));
  return {
    devices,
    alarms,
    source: "synthetic",
    dataset: DATASET_ID,
    updatedAt: SNAPSHOT_TIME,
  };
}
