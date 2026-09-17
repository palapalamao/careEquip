import test from "node:test";
import assert from "node:assert/strict";
import { createDataset } from "../src/data/fixtures.js";
import {
  normalizeWorkOrderRows,
  normalizeInspectionRows,
  buildDeviceTimeline,
  assertWoTransition,
  profilePatchOf,
  WO_TRANSITIONS,
} from "../src/data/model.js";

const ref = (val) => ({ _kind: "ref", val });
const marker = true;

test("F-A: FIN work order rows normalize with device names and chronological order", () => {
  const { devices } = createDataset();
  const byId = new Map(devices.map((d) => [d.id, d]));
  const rows = normalizeWorkOrderRows(
    [
      {
        id: ref("dm-demo-wo-001"),
        dmWorkOrder: marker,
        dmDeviceRef: ref("dm-demo-ahu-003"),
        dmWoType: "repair",
        dmWoStatus: "closed",
        dmWoAssignee: "王工",
        dmWoContent: "检修",
        dmWoScheduled: "2026-08-02T09:00:00+08:00",
        dmSynthetic: marker,
        dmDataset: "deviceManager-demo-v2",
      },
    ],
    byId,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].deviceCode, "AHU-003");
  assert.equal(rows[0].deviceName, devices.find((d) => d.id === "dm-demo-ahu-003").name);
  assert.equal(rows[0].source, "synthetic");
  assert.equal(rows[0].type, "repair");
});

test("F-A: device timeline merges work orders and inspections, newest first", () => {
  const { devices, workOrders, inspections } = createDataset();
  const id = devices[0].id;
  const timeline = buildDeviceTimeline(id, workOrders, inspections);
  for (let i = 1; i < timeline.length; i++) {
    assert.ok(String(timeline[i - 1].ts) >= String(timeline[i].ts));
  }
  const kinds = new Set(timeline.map((t) => t.kind));
  assert.ok(kinds.has("workOrder") || kinds.has("inspection"));
});

test("F-A: work order state machine allows only open->inProgress->closed", () => {
  assertWoTransition("open", "inProgress");
  assertWoTransition("inProgress", "closed");
  assert.throws(() => assertWoTransition("open", "closed"), /非法状态迁移/);
  assert.throws(() => assertWoTransition("closed", "open"), /非法状态迁移/);
  assert.deepEqual(WO_TRANSITIONS.closed, []);
});

test("F-A: profile patch only fills empty fields, never overwrites", () => {
  const device = { commissionDate: null, inServiceDate: "2024-09-01", acceptanceDocId: null };
  const patch = profilePatchOf(device, {
    commissionDate: "2024-06-30",
    inServiceDate: "2025-01-01",
    acceptanceDocUri: "archives://x.pdf",
  });
  assert.deepEqual(patch, { commissionDate: "2024-06-30", acceptanceDocUri: "archives://x.pdf" });
  assert.equal(profilePatchOf({ commissionDate: "2020-01-01" }, { commissionDate: "2024-06-30" }).commissionDate, undefined);
});

test("F-A: inspection rows normalize targets, results and synthetic provenance", () => {
  const rows = normalizeInspectionRows(
    [
      {
        id: ref("dm-demo-insp-001"),
        dmInspection: marker,
        dmInspectTarget: "medicalGas",
        dmInspectResult: "pass",
        dmInspectDate: "2026-08-05",
        dmSynthetic: marker,
        dmDataset: "deviceManager-demo-v2",
      },
    ],
    new Map(),
  );
  assert.equal(rows[0].target, "medicalGas");
  assert.equal(rows[0].result, "pass");
  assert.equal(rows[0].deviceName, "全院");
});
