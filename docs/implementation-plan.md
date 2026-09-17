# Device Manager implementation plan

Goal: deliver an isolated FIN POD with an End User 设备管理 app, preserving the source application's equipment observation workflows and petrol/teal visual language.

Architecture: React 19 Hash SPA, independent business data provider, explicit local synthetic mode and FIN project synthetic-record read mode, FIN BuildFinPod wrapper and menu. All changes stay under deviceManager. No old HTTP server or authentication is migrated. No automatic FIN writes or installation on build.

The user approved this direction in the preceding discussion and requested implementation. Work proceeds here without another design approval. Initial scope is the cross-module device workbench: overview, equipment inventory, module/location/status filtering, equipment detail with point readings and synthetic trends, alarm list, CSV export, empty/error/stale states. Other full source pages (custom scene editor, energy accounting, 3D, administration) are not claimed migrated by this increment.

- [x] Data: eight passing tests cover fixture identity, filtering, missing values, FIN normalization, SDK serialization, CSV export and replay-guarded seed planning.
- [x] UI: responsive application shell, inventory, detail dialog, overview and alarm views, adapted source presentation patterns and explicit provenance.
- [x] FIN: independent Ext/Lib, End User menu, complete relative resources, POD output inside this directory, namespaced seed preview; no automatic writes.
- [x] Verify: production/Fantom build, Axon parser, POD hashes and two browser scenarios passed. FIN Expert connector contract is not applicable and is not marked passed; details in validation.md.
- [x] Delivery: README, attribution, built POD, desktop/mobile screenshots and validation record.
- [ ] Live installation and seed execution: registered FIN connection authentication must be repaired; exact live write preview must be confirmed before execution.

Target compile toolchain observed: FIN 5.3.0.2761 installed locally. Registered local-mytest authentication failed (trace-129973871f0342d39bf1e296f6ad3680); live compatibility remains unverified.
