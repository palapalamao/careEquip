import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createSeedRecordsV2, createSeedExpressionV2 } from "./seed-data-v2.mjs";
const directory = new URL("../output/", import.meta.url);
await mkdir(directory, { recursive: true });
const records = createSeedRecordsV2(),
  expression = createSeedExpressionV2();
await writeFile(new URL("seed-deviceManager-v2.axon", directory), expression);
await writeFile(new URL("seed-records-v2.json", directory), JSON.stringify(records, null, 2));
const summary = {
  dataset: "deviceManager-demo-v2",
  records: records.length,
  docs: records.filter((r) => r.dmDoc).length,
  workOrders: records.filter((r) => r.dmWorkOrder).length,
  inspections: records.filter((r) => r.dmInspection).length,
  sha256: createHash("sha256").update(expression).digest("hex"),
  mode: "add-only, replay guarded, references v1 devices",
  executed: false,
};
await writeFile(new URL("seed-preview-v2.json", directory), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
