import { HDict } from "../ts/node_modules/haystack-core/dist/index.js";
import { createDataset, DATASET_ID } from "../ts/src/data/fixtures.js";
const marker = { _kind: "marker" };
const ref = (val) => ({ _kind: "ref", val });
export function createSeedRecords() {
  const { devices } = createDataset();
  const sites = [...new Set(devices.map((d) => d.site))];
  const common = {
    dmSynthetic: marker,
    dmDataset: DATASET_ID,
    dmProvenance: "deviceManager seed v1",
  };
  const records = sites.map((name, i) => ({
    ...common,
    id: ref(`dm-demo-site-${i}`),
    site: marker,
    dis: `[Synthetic] ${name}`,
    tz: "Shanghai",
  }));
  const floors = [
    ...new Set(devices.map((d) => `${sites.indexOf(d.site)}|${d.floor}`)),
  ];
  floors.forEach((key, i) => {
    const [siteIndex, name] = key.split("|");
    records.push({
      ...common,
      id: ref(`dm-demo-floor-${i}`),
      floor: marker,
      dis: `[Synthetic] ${name}`,
      siteRef: ref(`dm-demo-site-${siteIndex}`),
      floorNum: name === "B1" ? -1 : parseInt(name, 10),
    });
  });
  for (const d of devices) {
    const siteIndex = sites.indexOf(d.site),
      floorIndex = floors.indexOf(`${siteIndex}|${d.floor}`),
      p = d.points[0];
    records.push({
      ...common,
      id: ref(d.id),
      equip: marker,
      dmDevice: marker,
      dis: d.name,
      siteRef: ref(`dm-demo-site-${siteIndex}`),
      floorRef: ref(`dm-demo-floor-${floorIndex}`),
      dmCode: d.code,
      dmModule: d.module,
      dmType: d.type,
      dmSite: d.site,
      dmFloor: d.floor,
      dmStatus: d.status,
      dmQuality: d.quality,
      dmMetric: p.name,
      dmUnit: p.unit,
      ...(p.value === null ? {} : { dmValue: p.value }),
      dmUpdatedAt: d.updatedAt,
      dmManufacturer: d.manufacturer,
      dmModel: d.model,
    });
    records.push({
      ...common,
      id: ref(`${d.id}-primary`),
      point: marker,
      sensor: marker,
      dis: `${d.code} ${p.name}`,
      kind: "Number",
      unit: p.unit,
      siteRef: ref(`dm-demo-site-${siteIndex}`),
      equipRef: ref(d.id),
      dmQuality: p.quality,
      ...(p.value === null ? {} : { dmValue: p.value }),
    });
  }
  return records;
}
export function createSeedExpression() {
  const rows = createSeedRecords()
    .map((r) => HDict.make(r).toAxon())
    .join(",\n    ");
  return `do\n  existing: readAll(dmDataset == "${DATASET_ID}")\n  if (existing.size > 0) throw "deviceManager dataset already exists; reconcile it before any further write"\n  rows: [\n    ${rows}\n  ]\n  commit(rows.map(r => diff(null, r, {add})))\nend\n`;
}
