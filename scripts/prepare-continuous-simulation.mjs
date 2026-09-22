import { writeFileSync } from 'node:fs';
import { HDict } from '../ts/node_modules/haystack-core/dist/index.js';
import { createDataset, MODULES } from '../ts/src/data/fixtures.js';

// F-D 同口径：持续模拟按 storyline 规则取值（闲置 22/23、过载 41、昼夜/周末节律），
// 与 dmSeedSyntheticHistory / fixtures.synthVal 一致，保证利用率分析长期有效。
const configs = createDataset().devices.map((d, i) => {
  const base = MODULES.find(m => m.id === d.module).base + (i % 6) * 0.3;
  return `{equip:@${d.id},point:@${d.id}-primary,base:${base.toFixed(2)},idx:${i}}`;
});

// Fixed membership prevents newly created or unrelated points entering the job.
const tick = `do
  configs: [${configs.join(',\n')}]
  stamp: now().toTimeZone("Shanghai")
  ts0: dateTime(date(2026,01,01), time(00,00), "Shanghai")
  h: ((stamp - ts0) / 1hr).toInt
  hour: stamp.hour
  wd: weekday(stamp.date) / 1day
  weekend: wd == 0 or wd == 6
  configs.each(c => do
    p: readById(c->point)
    e: readById(c->equip)
    if (not p.has("dmSynthetic") or not p.has("dmTelemetrySeeded") or not p.has("his") or p->dmDataset != "deviceManager-demo-v1" or not e.has("dmSynthetic") or e->dmDataset != "deviceManager-demo-v1") throw "Simulation membership or history configuration changed"
  end)
  configs.each(c => do
    p: readById(c->point)
    e: readById(c->equip)
    base: c->base
    idx: c->idx
    tri: ((h + idx * 3) % 16) / 16
    dayBase: if (weekend) base * 0.85 else base
    value: if (idx == 22 or idx == 23) base * 0.01 else if (idx == 41) (if (h % 47 == 0) base * 1.15 else base * (1.02 + ((h % 8) / 8) * 0.08)) else if (hour < 7 or hour >= 23) base * 0.02 else dayBase * (0.5 + 0.35 * tri)
    if (not p.has("hisEnd") or p->hisEnd < stamp) do
      // FIN history writes are asynchronous.  Yield in the native job context
      // before advancing, so the history actor can complete this point.
      hisWrite({ts:stamp,val:value}, p)
      jobSleep(250ms)
      commit(diff(p, {curVal:value,curStatus:"ok"}, {transient}))
      commit(diff(p, {dmValue:value,dmQuality:"fresh",dmUpdatedAt:stamp}))
      commit(diff(e, {dmValue:value,dmQuality:"fresh",dmUpdatedAt:stamp}))
    end
  end)
  {points:configs.size,ts:stamp,source:"deviceManager synthetic continuous simulation v5 storyline"}
end`;

const job = HDict.make({
  id:{_kind:'ref',val:'dm-demo-telemetry-job'},
  dis:'设备管理模拟数据持续补充',
  job:{_kind:'marker'},
  jobExpr:tick,
  jobSchedule:'every 1min',
  dmSynthetic:{_kind:'marker'},
  dmSimulationTask:{_kind:'marker'},
  dmDataset:'deviceManager-demo-v1',
  dmProvenance:'deviceManager continuous simulation v1',
  doc:'Updates 48 synthetic current values and appends history every minute. Disable this job to stop. Never writes a connector or physical output.',
});

const install = `do
  if (readAll(id == @dm-demo-telemetry-job or dmSimulationTask).size > 0) throw "Simulation task already exists; inspect before changing"
  commit(diff(null, ${job.toAxon()}, {add}))
end`;
const updateTags = HDict.make({
  jobExpr:tick,
  dmProvenance:'deviceManager continuous simulation v5',
  doc:'Updates 48 synthetic current values and appends history every minute. Persists page snapshots and yields after each history write. Disable this job to stop. Never writes a connector or physical output.',
});
const updateTagsAxon = updateTags.toAxon();
const update = `do
  j: readById(@dm-demo-telemetry-job)
  if (not j.has("dmSimulationTask") or j->dmDataset != "deviceManager-demo-v1" or j->jobSchedule != "every 1min") throw "Unexpected simulation task identity or schedule"
  commit(diff(j, {disabled:removeMarker(),${updateTagsAxon.slice(1, -1)}}))
end`;
writeFileSync(new URL('../output/fin-import-ongoing-tick.axon', import.meta.url), tick);
writeFileSync(new URL('../output/fin-import-ongoing-install.axon', import.meta.url), install);
writeFileSync(new URL('../output/fin-import-ongoing-update.axon', import.meta.url), update);
writeFileSync(new URL('../output/fin-continuous-simulation-request.json', import.meta.url), JSON.stringify({tool:'fin_live_execute_axon',arguments:{request:{connection_id:'local-mytest',expression:install,confirmed:false,max_rows:1,timeout_seconds:30}}}, null, 2));
writeFileSync(new URL('../output/fin-continuous-simulation-update-request.json', import.meta.url), JSON.stringify({tool:'fin_live_execute_axon',arguments:{request:{connection_id:'local-mytest',expression:update,confirmed:false,max_rows:1,timeout_seconds:30}}}, null, 2));
console.log('Prepared one FIN scheduled job: 48 points, every 1min, append-only history. No live mutations executed.');
