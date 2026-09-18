import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createSeedRecordsV3, createSeedExpressionV3 } from "./seed-data-v3.mjs";
const directory = new URL("../output/", import.meta.url);
await mkdir(directory, { recursive: true });
const records = createSeedRecordsV3(),
  expression = createSeedExpressionV3();
await writeFile(new URL("seed-deviceManager-v3.axon", directory), expression);
await writeFile(new URL("seed-plans-v3.json", directory), JSON.stringify(records, null, 2));
const summary = {
  dataset: "deviceManager-demo-v2",
  records: records.length,
  plans: records.filter((r) => r.dmPlan).length,
  planExecs: records.filter((r) => r.dmPlanExec).length,
  sha256: createHash("sha256").update(expression).digest("hex"),
  mode: "add-only, replay guarded, references v2 dataset",
  executed: false,
};
await writeFile(new URL("seed-preview-v3.json", directory), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
