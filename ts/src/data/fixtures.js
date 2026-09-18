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
  const plans = createDemoPlans();
  const planExecs = createDemoPlanExecs(plans);
  return {
    devices,
    alarms,
    docs: createDemoDocs(devices),
    workOrders: createDemoWorkOrders(devices),
    inspections: createDemoInspections(devices),
    plans: plans,
    planExecs: planExecs,
    source: "synthetic",
    dataset: DATASET_ID,
    updatedAt: SNAPSHOT_TIME,
  };
}

// F-A R1.1：每台设备的验收资料档案
function createDemoDocs(devices) {
  return devices.map((d) => ({
    id: `dm-demo-doc-${d.code.toLowerCase()}-accept`,
    deviceCode: d.code,
    type: "acceptance",
    typeName: docTypeName("acceptance"),
    date: "2024-06-30",
    uri: `archives://${d.code}/acceptance-2024.pdf`,
    deviceId: d.id,
    provenance: "deviceManager seed v2",
    source: "synthetic",
  }));
}

// F-A R2.1：三甲医院规模确定性模拟工单（状态迁移合法、引用闭合、固定种子可重放）
// 规模：预防性维护 96（48 台×2 次）+ 科室报修 28 + 改造 6 ≈ 130 单，覆盖 2026-03 至 2026-09
const ENGINEERS = ["王建国", "李铁军", "赵晓东", "陈志明", "刘亚楠", "孙立军"];
const REPORT_DEPTS = ["急诊科", "重症医学科", "手术室", "住院部", "门诊部", "检验科", "放射科", "药剂科", "消毒供应中心", "血透中心"];
const GENERIC_RESULTS = ["保养完成，运行正常", "巡检无异常，记录归档", "完成保养并复测合格"];

// 固定种子伪随机：数据集在任何机器上重放结果一致
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const pad2 = (n) => String(n).padStart(2, "0");
// 时间一律在 UTC 帧内按北京时间墙钟构造与运算，保证跨时区确定性
const mk = (y, mo, d, hh, mi) => new Date(Date.UTC(y, mo - 1, d, hh, mi));
const iso = (dt) =>
  `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}T${pad2(dt.getUTCHours())}:${pad2(dt.getUTCMinutes())}:00+08:00`;
const isoDate = (dt) => `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
const addMinutes = (dt, mins) => new Date(dt.getTime() + mins * 60000);
const addDays = (dt, days) => new Date(dt.getTime() + days * 86400000);
const atSlot = (dt, hh, mm) => mk(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), hh, mm);

const WIN_START = mk(2026, 3, 2, 8, 30); // 数据窗口起点（快照 2026-09-09 之前）
const EARLY = mk(2026, 7, 1, 0, 0); // 7 月前：全部已关闭
const MID = mk(2026, 8, 21, 0, 0); // 8/21 前：大部关闭，少量进行中
const SCHED_SLOTS = [[8, 30], [9, 0], [14, 0], [15, 0]];

// 按设备系统的工单内容库（三甲后勤工程部口径）
const WO_CONTENT = {
  hvac: {
    maintenance: ["表冷器清洗与挡水板检查", "风机皮带张力检查与轴承润滑", "空调箱内部消杀", "送回风过滤网更换", "冷凝水盘清理与排水检查"],
    repair: [
      { content: "送风温度偏差大，检查表冷器与传感器", result: "更换温度传感器，试运行正常" },
      { content: "风机运行电流偏高，检查电机轴承", result: "更换轴承并加注润滑脂，电流恢复正常" },
      { content: "加湿段漏水，检查电磁阀与水位开关", result: "更换水位浮球开关，连续观察三天无渗漏" },
      { content: "房间压差波动，检查送回风阀执行器", result: "重新标定风阀执行器，压差稳定" },
    ],
  },
  power: {
    maintenance: ["季度巡检：紧固端子、清扫柜体、红外测温", "电容柜电容容量检查", "抽屉柜操作机构润滑检查", "柴油发电机带载试运行"],
    repair: [
      { content: "馈线柜温度异常，红外测温排查接点", result: "紧固母排连接螺栓，复测温度正常" },
      { content: "无功补偿投切异常，检查控制器与接触器", result: "更换接触器，功率因数恢复 0.95 以上" },
      { content: "出线回路偶发跳闸，检查电缆绝缘", result: "更换破损电缆段，绝缘复测合格" },
    ],
  },
  water: {
    maintenance: ["泵组例行保养：轴承润滑、机械密封检查", "水泵房环境消杀与集水坑清淤", "稳压罐压力校验", "管网压力波动检查"],
    repair: [
      { content: "供水压力波动大，检查变频器参数", result: "重新整定 PID 参数，压力波动恢复正常" },
      { content: "水泵异响，检查叶轮与汽蚀情况", result: "更换磨损叶轮，运行噪声恢复正常" },
      { content: "泵体渗漏，检查机械密封", result: "更换机械密封，试运行无渗漏" },
    ],
  },
  lighting: {
    maintenance: ["公共区域照明回路巡检，更换故障灯具", "照明控制时钟与光感校准", "应急照明充放电试验"],
    repair: [
      { content: "病区走廊灯具批量闪烁，检查驱动电源", result: "更换 LED 驱动电源，故障消除" },
      { content: "照明回路无法远程控制，检查控制模块", result: "更换继电器模块，远控恢复正常" },
    ],
  },
  elevator: {
    maintenance: ["电梯半月保养：曳引机、制动器、门系统检查", "电梯机房降温与井道照明检查", "五方对讲通话测试"],
    repair: [
      { content: "电梯运行平层误差大，检查曳引钢丝绳", result: "调整钢丝绳张力，平层精度恢复正常" },
      { content: "轿厢门开关异常，检查光幕与门机", result: "更换光幕组件，开关门恢复正常" },
      { content: "运行有异响，检查导靴与导轨润滑", result: "更换导靴衬垫并润滑导轨" },
    ],
  },
  safety: {
    maintenance: ["监控图像巡检，清理存储与校时", "门禁权限月度审计与备份", "入侵报警探测器灵敏度测试"],
    repair: [
      { content: "病区监控离线，检查 PoE 交换机", result: "更换交换机电源模块，图像恢复" },
      { content: "门禁刷卡无响应，检查读卡器与锁电源", result: "更换读卡器，刷卡恢复正常" },
    ],
  },
  "medical-space": {
    maintenance: ["手术室净化空调过滤器压差检查", "手术室墙面与地面清洁消毒检查", "压差梯度与换气次数月度测试"],
    repair: [
      { content: "手术室压差偏低，检查密封与新风量", result: "更换门密封条并调整新风阀，压差达标" },
      { content: "术中照明闪烁，检查手术灯电源", result: "更换手术灯电源模块" },
    ],
  },
  "medical-equipment": {
    maintenance: ["医疗设备监测终端数据核对与校准", "设备机房温湿度与 UPS 巡检"],
    repair: [
      { content: "监护数据上传中断，检查物联网网关", result: "升级网关固件，上传恢复" },
      { content: "药品冰箱温度报警频繁，检查传感器与门封", result: "更换温度传感器，报警消除" },
    ],
  },
};
const REPAIR_COUNTS = { hvac: 5, power: 4, water: 4, lighting: 3, elevator: 4, safety: 3, "medical-space": 2, "medical-equipment": 3 };
const RETROFITS = [
  { module: "medical-space", content: "手术室压差监测终端改造，更换为带报警输出型" },
  { module: "lighting", content: "地下车库照明 LED 分区节能改造" },
  { module: "safety", content: "视频监控存储扩容改造，录像保存 90 天" },
  { module: "power", content: "低压柜智能仪表改造，接入分项计量" },
  { module: "water", content: "生活水泵组加装远程启停与状态上传" },
  { module: "elevator", content: "电梯群控系统改造，优化高峰期调度" },
];

// 时间线决定状态：早期单已关闭，近期单进行中/待处理（单向迁移合法）
function statusByTimeline(rng, sched) {
  if (sched < EARLY) return "closed";
  if (sched < MID) return rng() < 0.78 ? "closed" : "inProgress";
  return rng() < 0.55 ? "open" : "inProgress";
}

function createDemoWorkOrders(devices) {
  const rng = mulberry32(1509);
  const byModule = (m) => devices.filter((d) => d.module === (typeof m === "string" ? m : m.id));
  const rows = [];
  // 1) 预防性维护：每台设备每季度-ish 一次，共 2 次
  for (const module of MODULES) {
    for (const dev of byModule(module)) {
      for (let k = 0; k < 2; k++) {
        const sched = atSlot(addDays(WIN_START, 2 + k * 82 + Math.floor(rng() * 24)), ...pick(rng, SCHED_SLOTS));
        const status = statusByTimeline(rng, sched);
        const started = status === "open" ? null : addMinutes(sched, 10 + Math.floor(rng() * 80));
        const closed = status === "closed" ? addMinutes(started, 60 + Math.floor(rng() * 300)) : null;
        rows.push({
          device: dev, type: "maintenance", status,
          assignee: pick(rng, ENGINEERS), scheduled: sched, started, closed,
          content: pick(rng, WO_CONTENT[module.id].maintenance),
          result: closed ? pick(rng, GENERIC_RESULTS) : "",
          createdBy: "后勤工程部",
        });
      }
    }
  }
  // 2) 科室报修：按系统故障权重分布
  for (const [moduleId, count] of Object.entries(REPAIR_COUNTS)) {
    const pool = byModule(moduleId);
    const bank = WO_CONTENT[moduleId].repair;
    for (let k = 0; k < count; k++) {
      const item = bank[k % bank.length];
      const sched = atSlot(addDays(WIN_START, Math.floor(rng() * 180)), ...pick(rng, SCHED_SLOTS));
      const status = statusByTimeline(rng, sched);
      const started = status === "open" ? null : addMinutes(sched, 10 + Math.floor(rng() * 80));
      const closed = status === "closed" ? addMinutes(started, 240 + Math.floor(rng() * 2640)) : null;
      rows.push({
        device: pool[Math.floor(rng() * pool.length)], type: "repair", status,
        assignee: pick(rng, ENGINEERS), scheduled: sched, started, closed,
        content: item.content, result: closed ? item.result : "",
        createdBy: pick(rng, REPORT_DEPTS) + "报修",
      });
    }
  }
  // 3) 改造：基建处立项，周期以天计
  for (const r of RETROFITS) {
    const sched = atSlot(addDays(WIN_START, 150 + Math.floor(rng() * 40)), ...pick(rng, SCHED_SLOTS));
    const status = statusByTimeline(rng, sched);
    const started = status === "open" ? null : addDays(sched, 1);
    const closed = status === "closed" ? atSlot(addDays(started, 2 + Math.floor(rng() * 7)), 17, 0) : null;
    const devs = byModule(r.module);
    rows.push({
      device: devs[Math.floor(rng() * devs.length)], type: "retrofit", status,
      assignee: pick(rng, ENGINEERS), scheduled: sched, started, closed,
      content: r.content, result: closed ? "改造完成，联调验收合格" : "",
      createdBy: "基建处",
    });
  }
  rows.sort((a, b) => a.scheduled - b.scheduled);
  return rows.map((r, i) => ({
    id: `dm-demo-wo-${String(i + 1).padStart(3, "0")}`,
    deviceId: r.device.id,
    deviceCode: r.device.code,
    deviceName: r.device.name,
    module: r.device.module,
    type: r.type,
    typeName: woTypeName(r.type),
    status: r.status,
    assignee: r.assignee,
    scheduled: iso(r.scheduled),
    started: r.started ? iso(r.started) : null,
    closed: r.closed ? iso(r.closed) : null,
    content: r.content,
    result: r.result,
    createdAt: iso(r.scheduled),
    createdBy: r.createdBy,
    dataset: RECORDS_DATASET_ID,
    source: "synthetic",
  }));
}

// F-A R2.2：三甲医院规模确定性模拟定期检测记录（对应标准 9.1.2 检测对象）
// 覆盖 9 类检测对象：4 类每月 2 次、4 类每季度、射线防护年度，共 65 条
function createDemoInspections(devices) {
  const byCode = (code) => devices.find((d) => d.code === code);
  const rows = [];
  const push = (dateStr, target, code, note, by, uri, result = "pass") =>
    rows.push({ date: dateStr, target, code, note, by, uri, result });
  const M3TO8 = [3, 4, 5, 6, 7, 8];
  // 每月 2 次（上旬 5 日 / 下旬 20 日；9 月只到快照日 9/9，故仅上旬）
  const monthly = [
    { target: "drinkingWater", codes: ["PMP-001", "PMP-002"], by: "后勤工程部", uri: "drinking-water.pdf",
      note: (slot) => `生活水泵房出水浊度、余氯检测（${slot}月检）` },
    { target: "medicalGas", codes: ["OR-001", "OR-002", "OR-003", "MED-001", "MED-002", "MED-003"], by: "器械科", uri: "medical-gas.pdf",
      note: (slot) => `手术室、ICU 医用气体终端压力与纯度检测（${slot}月检）` },
    { target: "sewage", codes: ["PMP-003", "PMP-006"], by: "后勤工程部", uri: "sewage.pdf",
      note: (slot) => `污水站出水 COD、氨氮检测（${slot}月检）` },
    { target: "medicalWaste", codes: [], by: "院感科", uri: "medical-waste.pdf",
      note: (slot) => `医疗废物分类收集、交接登记与暂存间检查（${slot}月检）` },
  ];
  let seq = 0;
  for (const m of monthly) {
    const slots = [...M3TO8.flatMap((mo) => [`2026-${pad2(mo)}-05`, `2026-${pad2(mo)}-20`]), "2026-09-05"];
    for (const dateStr of slots) {
      const slot = dateStr.endsWith("05") ? "上旬" : "下旬";
      const code = m.codes.length ? m.codes[seq % m.codes.length] : null;
      seq += 1;
      push(dateStr, m.target, code, m.note(slot), m.by, `reports://2026M${dateStr.slice(5, 7)}/${m.uri}`);
    }
    seq = 0;
  }
  // 每季度（3/15、6/15、9/5）
  const quarterly = [
    { target: "medicalWater", code: "PMP-002", by: "血透中心", uri: "medical-water.pdf", note: "血透用水细菌内毒素与电导率检测（季度）" },
    { target: "nonTraditionalWater", code: "PMP-004", by: "后勤工程部", uri: "reclaimed-water.pdf", note: "雨水收集池水质与中水回用检测（季度）" },
    { target: "hvac", code: "AHU-002", by: "后勤工程部", uri: "hvac-water.pdf", note: "空调冷却水、冷冻水水质检测与军团菌筛查（季度）" },
    { target: "indoorEnv", code: null, by: "后勤保障部", uri: "indoor-env.pdf", note: "门诊及住院病区噪声、照度、CO2 浓度检测（季度）" },
  ];
  for (const dateStr of ["2026-03-15", "2026-06-15", "2026-09-05"])
    for (const q of quarterly)
      push(dateStr, q.target, q.code, q.note, q.by, `reports://2026Q${Math.ceil(Number(dateStr.slice(5, 7)) / 3)}/${q.uri}`);
  // 年度检测
  push("2026-06-12", "radiation", null, "放射科机房防护年度检测", "放射防护组", "reports://2026/radiation.pdf");
  // 不合格项（闭环：转工单整改）
  for (const r of rows) {
    if (r.target === "sewage" && r.date === "2026-06-20") {
      r.result = "fail";
      r.note = "污水站出水 COD 超标，已转工单整改，复检后达标";
    }
    if (r.target === "medicalGas" && r.date === "2026-05-20") {
      r.result = "fail";
      r.note = "ICU 氧气终端压力偏低，已转工单整改并复检合格";
    }
  }
  rows.sort((a, b) => (a.date + a.target).localeCompare(b.date + b.target));
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
      reportUri: r.uri,
      createdAt: `${r.date}T10:00:00+08:00`,
      createdBy: r.by,
      dataset: RECORDS_DATASET_ID,
      source: "synthetic",
    };
  });
}

// ============ F-C 运行计划与执行考核（R-C / 9.2.6）============
// 计划系统枚举（03 §9 dmPlanSystem；module 供"转工单"推荐关联设备）
export const PLAN_SYSTEMS = [
  { id: "medicalGas", name: "医用气体", module: "medical-space" },
  { id: "elec", name: "电力", module: "power" },
  { id: "hvac", name: "空调", module: "hvac" },
  { id: "water", name: "供水", module: "water" },
  { id: "steam", name: "蒸汽", module: "water" },
  { id: "heating", name: "供热", module: "water" },
];
export const PLAN_EXEC_RESULTS = [
  { id: "done", name: "完成" },
  { id: "partial", name: "部分完成" },
  { id: "missed", name: "未完成" },
];
const planSystemName = (id) => PLAN_SYSTEMS.find((s) => s.id === id)?.name || id;
const planExecResultName = (id) => PLAN_EXEC_RESULTS.find((r) => r.id === id)?.name || id;
export { planSystemName, planExecResultName };

// 各系统月度运行计划内容库（三甲后勤口径，9.2.6 计划科学合理）
const PLAN_CONTENT = {
  medicalGas: [
    "医用气体汇流排巡检与备用瓶组切换演练",
    "手术室医用气体终端压力与泄漏检查",
    "液氧站液位、汽化器结霜与管网压力巡检",
  ],
  elec: [
    "供配电系统红外测温与负荷记录",
    "柴油发电机空载试运行与蓄电池检查",
    "UPS 电源切换测试与电容温度检查",
    "无功补偿装置投切情况检查",
  ],
  hvac: [
    "中央空调机组巡检与运行参数记录",
    "冷却水、冷冻水水质处理与加药",
    "手术室净化空调过滤器压差检查",
    "新风机组皮带、轴承与风阀检查",
  ],
  water: [
    "生活供水泵组保养与管网压力检查",
    "二次供水水箱清洗消毒与末梢水检测",
    "污水站设备运行巡检与出水水质监测",
    "雨水及中水回用系统检查",
  ],
  steam: [
    "蒸汽锅炉水质化验与安全附件校验",
    "蒸汽管网疏水阀与保温层巡检",
    "灭菌蒸汽压力稳定性检查（消毒供应中心）",
  ],
  heating: [
    "换热站一二次网运行参数记录与调节",
    "供热管网平衡调节与用户侧室温抽测",
    "板式换热器清洗与压降检查",
  ],
};

// F-C R-C.1：确定性月度运行计划（2026-01 ~ 2026-09，6 系统 × 9 周期）
function createDemoPlans() {
  const periods = ["2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08","2026-09"];
  const plans = [];
  for (const system of PLAN_SYSTEMS) {
    const bank = PLAN_CONTENT[system.id];
    periods.forEach((period, i) => {
      plans.push({
        id: `dm-demo-plan-${system.id}-${period}`,
        system: system.id,
        systemName: system.name,
        period,
        content: bank[i % bank.length],
        createdAt: `${period}-01T09:00:00+08:00`,
        createdBy: "后勤工程部",
        dataset: RECORDS_DATASET_ID,
        source: "synthetic",
      });
    });
  }
  return plans;
}

// F-C R-C.2：确定性执行登记（历史月基本执行，含少量部分完成/未完成用于考核）
function createDemoPlanExecs(plans) {
  const rng = mulberry32(9266);
  const execs = [];
  let seq = 0;
  for (const plan of plans) {
    const month = Number(plan.period.slice(5, 7));
    if (plan.period >= "2026-09") continue; // 当月（快照月）尚未登记
    let result;
    if (plan.system === "medicalGas" && plan.period === "2026-02") result = "missed"; // 春节值班人手不足
    else if (plan.system === "hvac" && plan.period === "2026-07") result = "partial"; // 高温保供期间部分完成
    else if (plan.system === "steam" && plan.period === "2026-06") result = "partial";
    else {
      const r = rng();
      result = r < 0.86 ? "done" : r < 0.96 ? "partial" : "missed";
    }
    seq += 1;
    const note =
      result === "done" ? "" :
      result === "partial" ? "高温保供/装修交叉作业影响，未完成项已顺延并跟踪" : "值班人手不足未执行，已列入年度考核改进项";
    execs.push({
      id: `dm-demo-exec-${String(seq).padStart(3, "0")}`,
      planId: plan.id,
      date: `${plan.period}-${String(10 + Math.floor(rng() * 15)).padStart(2, "0")}`,
      result,
      resultName: planExecResultName(result),
      note,
      createdAt: `${plan.period}-${String(20).padStart(2, "0")}T10:00:00+08:00`,
      createdBy: "后勤工程部",
      dataset: RECORDS_DATASET_ID,
      source: "synthetic",
    });
  }
  return execs;
}

// createDataset 组装：plans/planExecs 在 return 前生成（见上）
