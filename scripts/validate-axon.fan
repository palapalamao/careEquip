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
    (root + `output/`).listFiles.findAll |File f->Bool| { f.name.startsWith("fin-import-") && f.ext == "axon" }.each |File batch| {
      Parser(Loc(batch.name, 1), ("() => " + batch.readAllStr).in).parseTop("dmImportPreview", Etc.emptyDict)
    }
    echo("Axon parsed: menu and seed; nothing evaluated or written")
    telemetry := root + `output/fin-telemetry.axon`
    if (telemetry.exists) {
      Parser(Loc(telemetry.name, 1), ("() => " + telemetry.readAllStr).in).parseTop("dmTelemetryPreview", Etc.emptyDict)
      echo("Telemetry Axon parsed; nothing evaluated or written")
    }
  }
}
