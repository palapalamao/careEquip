using skyarc
using skyarcd

@ExtMeta {
  name = "deviceManager"
  depends = ["haystack", "finStackCore"]
}
const class DeviceManagerExt : Ext {
  override Void onStart() { log.info("deviceManager started: read-only UI; no automatic data mutations") }
  override Void onStop() { log.info("deviceManager stopped") }
}
