import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createSeedRecordsV4, createSeedExpressionV4 } from "./seed-data-v4.mjs";
const directory = new URL("../output/", import.meta.url);
await mkdir(directory, { recursive: true });
const records = createSeedRecordsV4(),
  expression = createSeedExpressionV4();
await writeFile(new URL("seed-deviceManager-v4.axon", directory), expression);
await writeFile(new URL("seed-exhaust-v4.json", directory), JSON.stringify(records, null, 2));
const summary = {
  dataset: "deviceManager-demo-v2",
  records: records.length,
  inspections: records.filter((r) => r.dmInspection).length,
  sha256: createHash("sha256").update(expression).digest("hex"),
  mode: "add-only, replay guarded, references v2 dataset",
  executed: false,
};
await writeFile(new URL("seed-preview-v4.json", directory), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
