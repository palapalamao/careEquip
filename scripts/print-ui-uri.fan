using skyarcd
class PrintUiUri {
  static Void main() { echo("/pod/deviceManager/" + PodMod.tsKey(Pod.find("deviceManager")) + "/res/web/dm/index.html") }
}
