using axon
using haystack

const class DeviceManagerLib {
  ** Runtime identity only. This library never writes project records.
  @Axon
  static Dict dmInfo() {
    Etc.makeDict(["podName":"deviceManager", "version":DeviceManagerExt#.pod.version.toStr,
      "uiUri":"/pod/deviceManager/res/web/dm/index.html", "readOnly":true])
  }
}
