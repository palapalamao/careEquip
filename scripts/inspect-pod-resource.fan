using skyarcd
class InspectPodResource {
  static Void main() {
    echo(PodSettings.stdExts)
    echo(Pod.find("deviceManager").file(`/res/web/dm/index.html`, false))
  }
}
