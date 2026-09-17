import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createSeedRecords, createSeedExpression } from "./seed-data.mjs";
const directory = new URL("../output/", import.meta.url);
await mkdir(directory, { recursive: true });
const records = createSeedRecords(),
  expression = createSeedExpression();
await writeFile(new URL("seed-deviceManager.axon", directory), expression);
await writeFile(
  new URL("seed-records.json", directory),
  JSON.stringify(records, null, 2),
);
const summary = {
  dataset: "deviceManager-demo-v1",
  records: records.length,
  sites: records.filter((r) => r.site).length,
  floors: records.filter((r) => r.floor).length,
  devices: records.filter((r) => r.equip).length,
  points: records.filter((r) => r.point).length,
  sha256: createHash("sha256").update(expression).digest("hex"),
  mode: "add-only, replay guarded",
  executed: false,
};
await writeFile(
  new URL("seed-preview.json", directory),
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary));
