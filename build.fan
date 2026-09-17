using finBuild

class Args : BuildFinArgs {
  new make() : super(Build#make) {}
}

class Build : BuildFinPod {
  new make(Args args) : super(args) {
    podName = "deviceManager"
    summary = "Hospital device management Web application"
    version = Version("0.1.0")
    meta = ["proj.name":podName, "org.name":"AI4Building", "license.name":"Commercial"]
    depends = ["sys 1.0+", "haystack 3.0.20+", "axon 3.0.20+", "skyarc 3.0.20+", "skyarcd 3.0.20+", "finStackCoreExt 5.0+"]
    srcDirs = [`fan/`]
    resDirs = [`lib/`, `locale/`, `res/web/dm/`]
    nodeDirs = [`ts/`]
    outPodDir = (scriptDir + `output/`).uri
    index = ["skyarc.ext":"deviceManager::DeviceManagerExt", "skyarc.lib":"deviceManager::DeviceManagerLib", "fin.lang":"deviceManager"]
  }
}
