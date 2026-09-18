// F-A seed v2：运维证据链记录
import { HDict } from "../ts/node_modules/haystack-core/dist/index.js";
// （dmDoc / dmWorkOrder / dmInspection）
// 数据集 deviceManager-demo-v2：只增、防重放、引用指向 v1 设备记录（闭合）。
// 防重放只针对 dmSynthetic 记录：真实运维记录（如用户经 I-W1 创建的工单）与种子共存，不受影响。
import { createDataset, DATASET_ID, RECORDS_DATASET_ID } from "../ts/src/data/fixtures.js";
const marker = { _kind: "marker" };
const ref = (val) => ({ _kind: "ref", val });
export function createSeedRecordsV2() {
  const { devices, docs, workOrders, inspections } = createDataset();
  const deviceIds = new Set(devices.map((d) => d.id));
  const common = {
    dmSynthetic: marker,
    dmDataset: RECORDS_DATASET_ID,
    dmProvenance: "deviceManager seed v2",
  };
  const records = [];
  for (const doc of docs) {
    records.push({
      ...common,
      id: ref(doc.id),
      dmDoc: marker,
      dis: `[Synthetic] ${doc.deviceCode} 验收资料`,
      dmDocType: doc.type,
      dmDocDate: doc.date,
      dmDocUri: doc.uri,
    });
  }
  for (const w of workOrders) {
    if (!deviceIds.has(w.deviceId)) throw new Error(`工单引用不存在的设备: ${w.deviceId}`);
    records.push({
      ...common,
      id: ref(w.id),
      dmWorkOrder: marker,
      dis: `[Synthetic] ${w.deviceCode} ${w.typeName}`,
      dmDeviceRef: ref(w.deviceId),
      dmWoType: w.type,
      dmWoStatus: w.status,
      dmWoAssignee: w.assignee,
      ...(w.scheduled ? { dmWoScheduled: w.scheduled } : {}),
      ...(w.started ? { dmWoStarted: w.started } : {}),
      ...(w.closed ? { dmWoClosed: w.closed } : {}),
      dmWoContent: w.content,
      ...(w.result ? { dmWoResult: w.result } : {}),
      dmCreatedAt: w.createdAt,
      dmCreatedBy: w.createdBy,
    });
  }
  for (const i of inspections) {
    if (i.deviceId && !deviceIds.has(i.deviceId))
      throw new Error(`检测记录引用不存在的设备: ${i.deviceId}`);
    records.push({
      ...common,
      id: ref(i.id),
      dmInspection: marker,
      dis: `[Synthetic] ${i.targetName} 定期检测`,
      ...(i.deviceId ? { dmDeviceRef: ref(i.deviceId) } : {}),
      dmInspectTarget: i.target,
      dmInspectResult: i.result,
      dmInspectDate: i.date,
      ...(i.note ? { dmInspectNote: i.note } : {}),
      ...(i.reportUri ? { dmReportUri: i.reportUri } : {}),
      dmCreatedAt: i.createdAt,
      dmCreatedBy: i.createdBy,
    });
  }
  return records;
}
export function createSeedExpressionV2() {
  const rows = createSeedRecordsV2()
    .map((r) => HDict.make(r).toAxon())
    .join(",\n    ");
  return `do\n  existing: readAll(dmDataset == "${RECORDS_DATASET_ID}" and dmSynthetic)\n  if (existing.size > 0) throw "deviceManager dataset ${RECORDS_DATASET_ID} already exists; reconcile it before any further write"\n  base: readAll(dmDataset == "${DATASET_ID}")\n  if (base.size == 0) throw "deviceManager dataset ${DATASET_ID} not found; seed v1 devices before v2 records"\n  rows: [\n    ${rows}\n  ]\n  commit(rows.map(r => diff(null, r, {add})))\nend\n`;
}


