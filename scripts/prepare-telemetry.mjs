import { writeFileSync } from 'node:fs';
import { createDataset, MODULES } from '../ts/src/data/fixtures.js';
const devices = createDataset().devices;
const configs = devices.map((d, i) => {
  const base = MODULES.find(m => m.id === d.module).base + (i % 6) * 0.3;
  return `{equip:@${d.id},point:@${d.id}-primary,base:${base.toFixed(2)},amp:${(base * 0.06).toFixed(3)},phase:${(i * 0.31).toFixed(2)}}`;
});
const expression = `do
  configs: [${configs.join(',\n')}]
  sampleEnd: now().toTimeZone("Shanghai")
  configs.each(c => do
    p: readById(c->point)
    e: readById(c->equip)
    if (not p.has("dmSynthetic") or p->dmDataset != "deviceManager-demo-v1" or not e.has("dmSynthetic")) throw "Only deviceManager synthetic records may be changed"
    if (p.has("his") or p.has("dmTelemetrySeeded")) throw "Existing history requires reconciliation before seeding"
  end)
  configs.each(c => do
    p: readById(c->point)
    samples: (0..96).map(i => {ts:sampleEnd - (96 - i) * 15min, val:c->base + sin(i*0.2 + c->phase)*c->amp})
    value: samples.last->val
    p = commit(diff(p, {his,cur,tz:"Shanghai",hisMode:"sampled",dmValue:value,dmQuality:"fresh",dmTelemetrySeeded,dmTelemetryEnd:sampleEnd,dmProvenance:"deviceManager synthetic telemetry v1"}))
    commit(diff(p, {curVal:value,curStatus:"ok"}, {transient}))
    e: readById(c->equip)
    commit(diff(e, {dmValue:value,dmQuality:"fresh",dmUpdatedAt:sampleEnd,dmPrimaryPointRef:p->id}))
    hisWrite(samples, p)
  end)
  {points:configs.size,samplesPerPoint:97,from:sampleEnd - 24hr,to:sampleEnd}
end`;
writeFileSync(new URL('../output/fin-telemetry.axon', import.meta.url), expression);
writeFileSync(new URL('../output/fin-telemetry-request.json', import.meta.url), JSON.stringify({tool:'fin_live_execute_axon',arguments:{request:{connection_id:'local-mytest',expression,confirmed:false,max_rows:10,timeout_seconds:60}}}, null, 2));
console.log(`Prepared ${devices.length} current values and ${devices.length * 97} history samples; no FIN writes executed.`);
