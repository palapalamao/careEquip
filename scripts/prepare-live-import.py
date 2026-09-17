"""Prepare bounded, replay-guarded FIN Expert import requests without executing them."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = (root / 'output/seed-deviceManager.axon').read_text(encoding='utf-8-sig')
records = [line.strip().rstrip(',') for line in source.splitlines() if line.strip().startswith('{dmSynthetic')]
records = [re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m[1], 16)), row) for row in records]
assert len(records) == 104
groups = [records[:32], records[32:56], records[56:]]
for index, group in enumerate(groups, 1):
    ids = [re.search(r'id:(@dm-demo-[a-z0-9-]+)', row)[1] for row in group]
    guard = ' or '.join(f'id == {ref}' for ref in ids)
    extra = []
    expression = '\n'.join([
        'do',
        f'  if (readAll({guard}).size > 0) throw "Import records already exist; reconcile first"',
        '  rows: [' + ',\n'.join(group + extra) + ']',
        '  commit(rows.map(r => diff(null, r, {add})))',
        'end',
    ])
    assert len(expression) <= 20000
    request = {'tool':'fin_live_execute_axon','arguments':{'request':{
        'connection_id':'local-mytest', 'expression':expression, 'confirmed':False, 'max_rows':60,
    }}}
    path = root / f'output/fin-import-{index}.json'
    path.write_text(json.dumps(request, ensure_ascii=False, indent=2), encoding='utf-8')
    (root / f'output/fin-import-{index}.axon').write_text(expression, encoding='utf-8')
    print(f'Batch {index}: {len(group) + len(extra)} records; {len(expression)} characters')

# Extension activation must use FIN's dedicated API: ext is a restricted tag.
activation = {'tool':'fin_live_execute_axon','arguments':{'request':{
    'connection_id':'local-mytest', 'expression':'extAdd("deviceManager")',
    'confirmed':False, 'max_rows':10,
}}}
(root / 'output/fin-enable-extension.json').write_text(
    json.dumps(activation, ensure_ascii=False, indent=2), encoding='utf-8')
