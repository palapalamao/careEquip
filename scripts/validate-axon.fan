using axon
using haystack

class ValidateAxon {
  static Void main(Str[] args) {
    root := File.os(args[0]).normalize
    menu := root + `lib/menu.trio`
    TrioReader(menu.in).readAllDicts.each |Dict record| {
      src := record["src"] as Str
      if (src != null) Parser(Loc(menu.name, 1), src.in).parseTop(record["name"].toStr, Etc.emptyDict)
    }
    seed := root + `output/seed-deviceManager.axon`
    Parser(Loc(seed.name, 1), ("() => " + seed.readAllStr).in).parseTop("dmSeedPreview", Etc.emptyDict)
    v2 := root + `output/seed-deviceManager-v2.axon`
    Parser(Loc(v2.name, 1), ("() => " + v2.readAllStr).in).parseTop("dmSeedV2Preview", Etc.emptyDict)
    v3 := root + `output/seed-deviceManager-v3.axon`
    v4 := root + `output/seed-deviceManager-v4.axon`
    if (v3.exists) {
      Parser(Loc(v3.name, 1), ("() => " + v3.readAllStr).in).parseTop("dmSeedV3Preview", Etc.emptyDict)
      if (v4.exists)
        Parser(Loc(v4.name, 1), ("() => " + v4.readAllStr).in).parseTop("dmSeedV4Preview", Etc.emptyDict)
      echo("Axon parsed: menu, seed v1/v2/v3/v4; nothing evaluated or written")
    } else {
      echo("Axon parsed: menu, seed v1/v2; nothing evaluated or written")
    }
    (root + `output/`).listFiles.findAll |File f->Bool| { f.name.startsWith("fin-import-") && f.ext == "axon" }.each |File batch| {
      Parser(Loc(batch.name, 1), ("() => " + batch.readAllStr).in).parseTop("dmImportPreview", Etc.emptyDict)
    }
    telemetry := root + `output/fin-telemetry.axon`
    if (telemetry.exists) {
      Parser(Loc(telemetry.name, 1), ("() => " + telemetry.readAllStr).in).parseTop("dmTelemetryPreview", Etc.emptyDict)
      echo("Telemetry Axon parsed; nothing evaluated or written")
    }
  }
}
