import test from "node:test";
import assert from "node:assert/strict";
import {
  createSeedRecords,
  createSeedExpression,
} from "../../scripts/seed-data.mjs";
import { HGrid } from "haystack-core";
import { normalizeFinRows } from "../src/data/model.js";
test("FIN Hayson serialization from the SDK preserves marker and ref identities", () => {
  const rows = HGrid.make(
    createSeedRecords().filter((r) => r.dmDevice),
  ).toJSON().rows;
  const result = normalizeFinRows(rows);
  assert.equal(result.devices.length, 48);
  assert.ok(
    result.devices.every(
      (d) => d.source === "synthetic" && d.id.startsWith("dm-demo-"),
    ),
  );
  assert.equal(result.devices[0].points[0].value, 18);
});
test("FIN synthetic seed has complete references, no writable tags and matches UI identity", () => {
  const records = createSeedRecords(),
    ids = new Set(records.map((r) => r.id.val));
  assert.equal(ids.size, records.length);
  assert.equal(records.filter((r) => r.dmDevice).length, 48);
  for (const r of records) {
    assert.ok(r.dmSynthetic);
    assert.equal(r.dmDataset, "deviceManager-demo-v1");
    assert.ok(!r.writable && !r.bacnetConnRef);
    for (const key of ["siteRef", "floorRef", "equipRef"])
      if (r[key]) assert.ok(ids.has(r[key].val));
  }
});
test("seed is guarded against replay, only adds and is never deployed as an automatic function", () => {
  const expression = createSeedExpression();
  assert.ok(expression.indexOf("readAll(") < expression.indexOf("commit("));
  assert.ok(expression.includes("throw"));
  assert.ok(expression.includes("{add}"));
  assert.ok(!expression.includes("{remove}"));
});
