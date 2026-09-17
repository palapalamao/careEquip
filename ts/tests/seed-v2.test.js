import test from "node:test";
import assert from "node:assert/strict";
import {
  createSeedRecordsV2,
  createSeedExpressionV2,
} from "../../scripts/seed-data-v2.mjs";
import { createSeedRecords } from "../../scripts/seed-data.mjs";

test("F-A: seed v2 records are add-only, replay guarded and reference v1 devices", () => {
  const v1 = createSeedRecords();
  const v1Ids = new Set(v1.map((r) => r.id.val));
  const v1Devices = new Set(v1.filter((r) => r.dmDevice).map((r) => r.id.val));
  const records = createSeedRecordsV2();
  const ids = new Set(records.map((r) => r.id.val));
  assert.equal(ids.size, records.length);
  assert.ok(records.every((r) => r.dmSynthetic));
  assert.ok(records.every((r) => r.dmDataset === "deviceManager-demo-v2"));
  for (const r of records) {
    assert.ok(!r.writable && !r.bacnetConnRef);
    if (r.dmDeviceRef) {
      assert.ok(v1Devices.has(r.dmDeviceRef.val), `悬空引用: ${r.dmDeviceRef.val}`);
    }
    assert.ok(!v1Ids.has(r.id.val), `v2 id 与 v1 冲突: ${r.id.val}`);
  }
  assert.equal(records.filter((r) => r.dmDoc).length, 48);
  assert.equal(records.filter((r) => r.dmWorkOrder).length, 4);
  assert.equal(records.filter((r) => r.dmInspection).length, 5);
  const wo = records.filter((r) => r.dmWorkOrder);
  assert.ok(wo.every((r) => ["open", "inProgress", "closed"].includes(r.dmWoStatus)));
});

test("F-A: seed v2 expression guards replay and requires v1 base dataset", () => {
  const expression = createSeedExpressionV2();
  assert.ok(expression.indexOf("readAll(") < expression.indexOf("commit("));
  assert.ok(expression.includes("throw"));
  assert.ok(expression.includes("{add}"));
  assert.ok(!expression.includes("{remove}"));
  assert.ok(expression.includes("deviceManager-demo-v1"));
});
