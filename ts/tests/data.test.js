import test from "node:test";
import assert from "node:assert/strict";
import { createDataset } from "../src/data/fixtures.js";
import {
  filterDevices,
  summarize,
  toCsv,
  normalizeFinRows,
  normalizeHistoryRows,
  resolveProject,
} from "../src/data/model.js";

test("FIN history handles unit numbers, zeroes, gaps and chronological order", () => {
  const rows = normalizeHistoryRows([
    {ts:{_kind:"dateTime",val:"2026-09-09T02:00:00+08:00"},v0:{_kind:"number",val:12.3,unit:"Pa"}},
    {ts:"2026-09-09T01:00:00+08:00",v0:0},
    {ts:"bad timestamp",v0:8},
    {ts:"2026-09-09T01:30:00+08:00",v0:null},
  ]);
  assert.deepEqual(rows.map(r=>r.value), [0,12.3]);
  const device = normalizeFinRows([{id:"test",dmPrimaryPointRef:{_kind:"ref",val:"p:mytest:r:dm-demo-ahu-001-primary"}}]).devices[0];
  assert.equal(device.historyPointId,"p:mytest:r:dm-demo-ahu-001-primary");
});

test("synthetic fixtures are repeatable, linked and never disguise missing readings as zero", () => {
  const a = createDataset();
  assert.deepEqual(a, createDataset());
  assert.equal(new Set(a.devices.map((d) => d.id)).size, a.devices.length);
  assert.ok(a.devices.length >= 24);
  assert.ok(a.devices.every((d) => d.source === "synthetic"));
  assert.ok(a.devices.some((d) => d.points.some((p) => p.value === null)));
  assert.ok(
    a.alarms.every((alarm) => a.devices.some((d) => d.id === alarm.deviceId)),
  );
});
test("filters combine module, status, floor and free text, summaries preserve unknowns", () => {
  const { devices } = createDataset();
  const row = devices[0];
  assert.deepEqual(
    filterDevices(devices, {
      search: row.code,
      module: row.module,
      floor: row.floor,
      status: row.status,
    }),
    [row],
  );
  assert.equal(filterDevices(devices, { search: "不存在的设备" }).length, 0);
  const summary = summarize(devices);
  assert.equal(summary.total, devices.length);
  assert.equal(
    summary.healthy + summary.attention + summary.unknown,
    devices.length,
  );
});
test("FIN rows require explicit provenance, preserve missing values and do not invent history", () => {
  const data = normalizeFinRows([
    {
      id: "@abc",
      dis: "测试",
      dmSynthetic: true,
      dmCode: "A",
      dmModule: "hvac",
      dmValue: 0,
      dmUnit: "°C",
    },
    { id: "@unknown", dis: "No provenance" },
  ]);
  assert.equal(data.devices[0].points[0].value, 0);
  assert.equal(data.devices[0].source, "synthetic");
  assert.deepEqual(data.devices[0].trend, []);
  assert.equal(data.devices[1].source, "unknown");
  assert.equal(data.devices[1].points[0].value, null);
});
test("CSV escapes quotes, newlines and spreadsheet formulas and includes provenance", () => {
  const csv = toCsv([
    { ...createDataset().devices[0], name: '=SUM(1,2)\n"name"' },
  ]);
  assert.ok(csv.includes("'=SUM"));
  assert.ok(csv.includes('""name""'));
  assert.ok(csv.includes("Synthetic"));
});
test("project context is explicit with no sys fallback", () => {
  assert.equal(
    resolveProject({
      shell: "mytest",
      query: "other",
      dev: "dev",
      isDev: false,
    }),
    "mytest",
  );
  assert.equal(resolveProject({ query: "mytest" }), "mytest");
  assert.equal(resolveProject({ dev: "dev", isDev: false }), "");
  assert.equal(resolveProject({ dev: "dev", isDev: true }), "dev");
  assert.equal(resolveProject({ query: "../../sys" }), "");
});
