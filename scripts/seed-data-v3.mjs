// F-C seed v3：运行计划与执行登记记录
// （dmPlan / dmPlanExec，数据集 deviceManager-demo-v2：只增、防重放、引用闭合）
import { HDict } from "../ts/node_modules/haystack-core/dist/index.js";
import { createDataset, RECORDS_DATASET_ID } from "../ts/src/data/fixtures.js";
const marker = { _kind: "marker" };
const ref = (val) => ({ _kind: "ref", val });
export function createSeedRecordsV3() {
  const { plans, planExecs } = createDataset();
  const planIds = new Set(plans.map((p) => p.id));
  const common = {
    dmSynthetic: marker,
    dmDataset: RECORDS_DATASET_ID,
    dmProvenance: "deviceManager seed v3",
  };
  const records = [];
  for (const p of plans) {
    records.push({
      ...common,
      id: ref(p.id),
      dmPlan: marker,
      dis: `[Synthetic] ${p.systemName} ${p.period} 运行计划`,
      dmPlanSystem: p.system,
      dmPlanPeriod: p.period,
      dmPlanContent: p.content,
      dmCreatedAt: p.createdAt,
      dmCreatedBy: p.createdBy,
    });
  }
  for (const e of planExecs) {
    if (!planIds.has(e.planId)) throw new Error(`执行登记引用不存在的计划: ${e.planId}`);
    records.push({
      ...common,
      id: ref(e.id),
      dmPlanExec: marker,
      dis: `[Synthetic] ${e.id} 执行登记`,
      dmPlanRef: ref(e.planId),
      dmExecDate: e.date,
      dmExecResult: e.result,
      ...(e.note ? { dmExecNote: e.note } : {}),
      dmCreatedAt: e.createdAt,
      dmCreatedBy: e.createdBy,
    });
  }
  return records;
}
export function createSeedExpressionV3() {
  const rows = createSeedRecordsV3()
    .map((r) => HDict.make(r).toAxon())
    .join(",\n    ");
  return `do
  existing: readAll(dmPlan and dmSynthetic and dmDataset == "${RECORDS_DATASET_ID}")
  if (existing.size > 0) throw "deviceManager plans already seeded for ${RECORDS_DATASET_ID}; reconcile before any further write"
  base: readAll(dmDataset == "${RECORDS_DATASET_ID}")
  if (base.size == 0) throw "deviceManager dataset ${RECORDS_DATASET_ID} not found; seed v2 records before v3 plans"
  rows: [
    ${rows}
  ]
  commit(rows.map(r => diff(null, r, {add})))
end
`;
}
