// F-A seed v4：医疗废气排放定期检测（9.1.2 控制项第 8 项，v0.3.2 补录）
// （dmInspection，数据集 deviceManager-demo-v2：只增、防重放）
import { HDict } from "../ts/node_modules/haystack-core/dist/index.js";
import { createDataset, RECORDS_DATASET_ID } from "../ts/src/data/fixtures.js";
const marker = { _kind: "marker" };
const ref = (val) => ({ _kind: "ref", val });
export function createSeedRecordsV4() {
  const { inspections } = createDataset({ exhaust: true });
  const common = {
    dmSynthetic: marker,
    dmDataset: RECORDS_DATASET_ID,
    dmProvenance: "deviceManager seed v4",
  };
  return inspections
    .filter((i) => i.target === "medicalExhaust")
    .map((i) => ({
      ...common,
      id: ref(`dm-demo-insp-exhaust-${i.date}`),
      dmInspection: marker,
      dis: `[Synthetic] ${i.targetName} 定期检测`,
      dmInspectTarget: i.target,
      dmInspectResult: i.result,
      dmInspectDate: i.date,
      ...(i.note ? { dmInspectNote: i.note } : {}),
      ...(i.reportUri ? { dmReportUri: i.reportUri } : {}),
      dmCreatedAt: i.createdAt,
      dmCreatedBy: i.createdBy,
    }));
}
export function createSeedExpressionV4() {
  const rows = createSeedRecordsV4()
    .map((r) => HDict.make(r).toAxon())
    .join(",\n    ");
  return `do
  existing: readAll(dmInspection and dmSynthetic and dmProvenance == "deviceManager seed v4")
  if (existing.size > 0) throw "deviceManager exhaust inspections already seeded; reconcile before any further write"
  base: readAll(dmDataset == "${RECORDS_DATASET_ID}" and dmSynthetic)
  if (base.size == 0) throw "deviceManager dataset ${RECORDS_DATASET_ID} not found; seed v2 records before v4 exhaust inspections"
  rows: [
    ${rows}
  ]
  commit(rows.map(r => diff(null, r, {add})))
end
`;
}
