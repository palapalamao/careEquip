using axon
using haystack
using skyarcd

const class DeviceManagerLib {
  ** Runtime identity plus guarded record writes (F-A).
  ** 写函数原则：参数校验 → 校验引用闭合 → 只增不改；
  ** 唯一允许的"改"是工单状态单向迁移与档案空缺字段补充，均留痕。
  @Axon
  static Dict dmInfo() {
    Etc.makeDict(["podName":"deviceManager", "version":DeviceManagerExt#.pod.version.toStr,
      "uiUri":"/pod/deviceManager/res/web/dm/index.html", "readOnly":false,
      "writes":"dmCreateWorkOrder/dmTransitWorkOrder/dmSaveDeviceProfile/dmCreateInspection/dmCreatePlan/dmRecordPlanExec/dmSavePlanReview/dmBackfillSyntheticCosts/dmSeedSyntheticHistory"])
  }

  ** I-W1 新建运维工单。校验设备引用存在；写入只增记录。
  @Axon
  static Dict dmCreateWorkOrder(Dict rec) {
    deviceRef := rec["dmDeviceRef"] as Ref ?:
      throw ArgErr("dmDeviceRef is required")
    type := rec["dmWoType"] as Str
    if (type != null && !["maintenance","repair","retrofit"].contains(type))
      throw ArgErr("dmWoType must be maintenance/repair/retrofit")
    content := rec["dmWoContent"] as Str ?: throw ArgErr("dmWoContent is required")
    device := evalReadById(deviceRef)
    if (device["dmDevice"] == null && device["equip"] == null)
      throw ArgErr("dmDeviceRef does not reference a device equip: ${deviceRef}")
    ts := DateTime.nowUtc
    map := Str:Obj[
      "id":          uniqueRef("dm-wo"),
      "dmWorkOrder": Marker.val,
      "dmDeviceRef": deviceRef,
      "dmWoType":    type ?: "maintenance",
      "dmWoStatus":  "open",
      "dmWoAssignee":rec["dmWoAssignee"] ?: "未指派",
      "dmWoContent": content,
      "dmCreatedAt": ts,
      "dmCreatedBy": contextUser(),
      "dmDataset":   rec["dmDataset"] ?: "deviceManager-records",
    ]
    if (rec["dmWoScheduled"] != null) map["dmWoScheduled"] = rec["dmWoScheduled"]
    woCost := rec["dmWoCost"]
    if (woCost != null) {
      if (!(woCost is Number) || (woCost as Number).toFloat < 0f)
        throw ArgErr("dmWoCost must be a non-negative number")
      map["dmWoCost"] = woCost
    }
    id := map["id"]
    commitAdd(Etc.makeDict(map))
    return evalReadById(id)
  }

  ** I-W2 工单状态迁移：open→inProgress→closed 单向，拒绝跳变与回退。
  @Axon
  static Dict dmTransitWorkOrder(Ref id, Str target, Str? note := null) {
    rec := evalReadById(id)
    if (rec["dmWorkOrder"] == null) throw ArgErr("not a work order: ${id}")
    cur := rec["dmWoStatus"] as Str ?: "open"
    allowed := Str:Str[][
      "open":       ["inProgress"],
      "inProgress": ["closed"],
      "closed":     Str[,],
    ]
    if (!allowed[cur].contains(target))
      throw ArgErr("illegal transition: ${cur} -> ${target}")
    ts := DateTime.nowUtc
    changes := Str:Obj[
      "dmWoStatus":       target,
      "dmLastTransition": ts,
      "dmLastOperator":   contextUser(),
    ]
    if (target == "inProgress") changes["dmWoStarted"] = ts
    if (target == "closed") {
      result := (note ?: "").trim
      if (result.isEmpty)
        throw ArgErr("dmWoResult is required when closing a work order")
      changes["dmWoClosed"] = ts
      changes["dmWoResult"] = result
    }
    commitUpdate(rec, Etc.makeDict(changes))
    return evalReadById(id)
  }

  ** I-W3 补充设备档案：仅允许空→有，不覆盖既有值。
  @Axon
  static Dict dmSaveDeviceProfile(Ref id, Dict patch) {
    rec := evalReadById(id)
    if (rec["dmDevice"] == null && rec["equip"] == null)
      throw ArgErr("not a device equip: ${id}")
    fills := Str:Obj[:]
    if (patch["dmCommissionDate"] != null && rec["dmCommissionDate"] == null)
      fills["dmCommissionDate"] = patch["dmCommissionDate"]
    if (patch["dmInServiceDate"] != null && rec["dmInServiceDate"] == null)
      fills["dmInServiceDate"] = patch["dmInServiceDate"]
    if (patch["dmDocUri"] != null && rec["dmAcceptanceDocRef"] == null) {
      docId := uniqueRef("dm-doc")
      doc := Etc.makeDict(Str:Obj[
        "id":          docId,
        "dmDoc":       Marker.val,
        "dmDocType":   "acceptance",
        "dmDocDate":   patch["dmCommissionDate"] ?: Date.today,
        "dmDocUri":    patch["dmDocUri"],
        "dmDataset":   patch["dmDataset"] ?: "deviceManager-records",
        "dmCreatedBy": contextUser(),
      ])
      commitAdd(doc)
      fills["dmAcceptanceDocRef"] = docId
    }
    if (patch["dmPurchaseCost"] != null && rec["dmPurchaseCost"] == null) {
      v := patch["dmPurchaseCost"]
      if (!(v is Number) || (v as Number).toFloat <= 0f)
        throw ArgErr("dmPurchaseCost must be a positive number")
      fills["dmPurchaseCost"] = v
    }
    if (patch["dmAnnualBenefit"] != null && rec["dmAnnualBenefit"] == null) {
      v := patch["dmAnnualBenefit"]
      if (!(v is Number) || (v as Number).toFloat <= 0f)
        throw ArgErr("dmAnnualBenefit must be a positive number")
      fills["dmAnnualBenefit"] = v
    }
    if (patch["dmRatedValue"] != null && rec["dmRatedValue"] == null) {
      v := patch["dmRatedValue"]
      if (!(v is Number) || (v as Number).toFloat <= 0f)
        throw ArgErr("dmRatedValue must be a positive number")
      fills["dmRatedValue"] = v
    }
    if (fills.isEmpty) throw ArgErr("no fillable fields (only empty fields may be filled)")
    commitUpdate(rec, Etc.makeDict(fills))
    return evalReadById(id)
  }

  ** I-W4 新建定期检测记录。
  @Axon
  static Dict dmCreateInspection(Dict rec) {
    target := rec["dmInspectTarget"] as Str ?:
      throw ArgErr("dmInspectTarget is required")
    if (!["drinkingWater","medicalWater","nonTraditionalWater","medicalGas","hvac","sewage","medicalWaste","radiation","indoorEnv"].contains(target))
      throw ArgErr("unknown dmInspectTarget: ${target}")
    result := rec["dmInspectResult"] as Str ?: "pass"
    if (!["pass","fail"].contains(result)) throw ArgErr("dmInspectResult must be pass/fail")
    date := rec["dmInspectDate"] ?:
      throw ArgErr("dmInspectDate is required")
    deviceRef := rec["dmDeviceRef"] as Ref
    if (deviceRef != null) evalReadById(deviceRef)
    map := Str:Obj[
      "id":              uniqueRef("dm-insp"),
      "dmInspection":    Marker.val,
      "dmInspectTarget": target,
      "dmInspectResult": result,
      "dmInspectDate":   date,
      "dmCreatedAt":     DateTime.nowUtc,
      "dmCreatedBy":     contextUser(),
      "dmDataset":       rec["dmDataset"] ?: "deviceManager-records",
    ]
    if (deviceRef != null) map["dmDeviceRef"] = deviceRef
    if (rec["dmInspectNote"] != null) map["dmInspectNote"] = rec["dmInspectNote"]
    if (rec["dmReportUri"] != null) map["dmReportUri"] = rec["dmReportUri"]
    id := map["id"]
    commitAdd(Etc.makeDict(map))
    return evalReadById(id)
  }


  ** I-W8 新建运行计划（F-C R-C.1）：同系统+同周期+同数据集拒绝重复（防重放）。
  @Axon
  static Dict dmCreatePlan(Dict rec) {
    system := rec["dmPlanSystem"] as Str ?:
      throw ArgErr("dmPlanSystem is required")
    if (!["medicalGas","elec","hvac","water","steam","heating"].contains(system))
      throw ArgErr("dmPlanSystem must be medicalGas/elec/hvac/water/steam/heating")
    period := rec["dmPlanPeriod"] as Str ?:
      throw ArgErr("dmPlanPeriod is required")
    if (period.size != 7 || !Regex("^\\d{4}-\\d{2}").matches(period) || period.endsWith("-00"))
      throw ArgErr("dmPlanPeriod must be YYYY-MM")
    content := (rec["dmPlanContent"] as Str)?.trim ?: throw ArgErr("dmPlanContent is required")
    dataset := rec["dmDataset"] ?: "deviceManager-records"
    filter := "dmPlan and dmPlanSystem == \"" + system + "\" and dmPlanPeriod == \"" +
              period + "\" and dmDataset == \"" + dataset.toStr + "\""
    dup := 0
    readAllFilter(filter).each |Dict d| { dup++ }
    if (dup > 0)
      throw ArgErr("plan already exists: " + system + "/" + period + "/" + dataset)
    id := uniqueRef("dm-plan")
    commitAdd(Etc.makeDict(Str:Obj[
      "id":             id,
      "dmPlan":         Marker.val,
      "dmPlanSystem":   system,
      "dmPlanPeriod":   period,
      "dmPlanContent":  content,
      "dmCreatedAt":    DateTime.nowUtc,
      "dmCreatedBy":    contextUser(),
      "dmDataset":      dataset,
    ]))
    return evalReadById(id)
  }

  ** I-W8 执行登记（F-C R-C.2）：校验 dmPlanRef 闭合；结果 done/partial/missed。
  @Axon
  static Dict dmRecordPlanExec(Dict rec) {
    planRef := rec["dmPlanRef"] as Ref ?:
      throw ArgErr("dmPlanRef is required")
    plan := evalReadById(planRef)
    if (plan["dmPlan"] == null)
      throw ArgErr("dmPlanRef does not reference a plan: " + planRef.toStr)
    date := rec["dmExecDate"] ?:
      throw ArgErr("dmExecDate is required")
    result := rec["dmExecResult"] as Str ?:
      throw ArgErr("dmExecResult is required")
    if (!["done","partial","missed"].contains(result))
      throw ArgErr("dmExecResult must be done/partial/missed")
    id := uniqueRef("dm-exec")
    map := Str:Obj[
      "id":            id,
      "dmPlanExec":    Marker.val,
      "dmPlanRef":     planRef,
      "dmExecDate":    date,
      "dmExecResult":  result,
      "dmCreatedAt":   DateTime.nowUtc,
      "dmCreatedBy":   contextUser(),
      "dmDataset":     rec["dmDataset"] ?: "deviceManager-records",
    ]
    note := (rec["dmExecNote"] as Str)?.trim
    if (note != null && !note.isEmpty) map["dmExecNote"] = note
    commitAdd(Etc.makeDict(map))
    return evalReadById(id)
  }

  ** 当前用户标识（留痕）；userId 不可用时回退固定标识
  private static Str contextUser() {
    try {
      uid := AxonContext.curAxon.call("userId", Obj?[,])
      if (uid != null) return uid.toStr
    } catch (Err e) {}
    return "fin-user"
  }

  ** 唯一记录 ID：UTC 时间戳去格式化（毫秒级，单次调用内唯一）
  private static Ref uniqueRef(Str prefix) {
    stamp := DateTime.nowUtc.toStr
      .replace(":", "")
      .replace(".", "")
      .replace(" ", "")
      .replace("Z", "")
    return Ref("${prefix}-${stamp}")
  }

  ** 经 Axon 上下文读取记录
  private static Dict evalReadById(Ref id) {
    obj := AxonContext.curAxon.call("readById", [id])
    dict := (Dict?)obj ?: throw ArgErr("record not found: ${id}")
    return dict
  }

  ** 只增：diff(null, rec, {add}) 后 commit
  private static Void commitAdd(Dict rec) {
    flags := Etc.makeDict(["add":Marker.val])
    d := AxonContext.curAxon.call("diff", [null, rec, flags])
    AxonContext.curAxon.call("commit", [d])
  }

  ** I-W10 年度考核结论落库（F-C R-C.3，v0.3.2）：同一 system+year 覆盖更新
  ** （考核结论是派生汇总，非原始证据，是"只增不改"的 documented 例外）。
  @Axon
  static Dict dmSavePlanReview(Dict rec) {
    system := rec["dmReviewSystem"] as Str ?:
      throw ArgErr("dmReviewSystem is required")
    if (!["medicalGas","elec","hvac","water","steam","heating"].contains(system))
      throw ArgErr("dmReviewSystem must be medicalGas/elec/hvac/water/steam/heating")
    year := rec["dmReviewYear"] as Str ?:
      throw ArgErr("dmReviewYear is required")
    if (!Regex("^\\d{4}").matches(year) || year.size != 4)
      throw ArgErr("dmReviewYear must be YYYY")
    conclusion := rec["dmReviewConclusion"] as Str ?:
      throw ArgErr("dmReviewConclusion is required")
    if (!["优秀","合格","基本合格","不合格"].contains(conclusion))
      throw ArgErr("dmReviewConclusion must be 优秀/合格/基本合格/不合格")
    summary := rec["dmReviewSummary"] ?: Etc.makeDict(Str:Obj[:])
    filter := "dmPlanReviewRec and dmReviewSystem == \"" + system +
              "\" and dmReviewYear == \"" + year + "\""
    existing := Ref?[,]
    readAllFilter(filter).each |Dict d| {
      r := d["id"] as Ref
      if (r != null) existing.add(r)
    }
    ts := DateTime.nowUtc
    if (existing.size > 0) {
      cur := evalReadById(existing.first)
      commitUpdate(cur, Etc.makeDict(Str:Obj[
        "dmReviewSummary":   summary,
        "dmReviewConclusion": conclusion,
        "dmReviewSavedAt":   ts,
        "dmReviewSavedBy":   contextUser(),
      ]))
      return evalReadById(existing.first)
    }
    id := uniqueRef("dm-review")
    commitAdd(Etc.makeDict(Str:Obj[
      "id":                 id,
      "dmPlanReviewRec":    Marker.val,
      "dmReviewSystem":     system,
      "dmReviewYear":       year,
      "dmReviewSummary":    summary,
      "dmReviewConclusion": conclusion,
      "dmReviewSavedAt":    ts,
      "dmReviewSavedBy":    contextUser(),
    ]))
    return evalReadById(id)
  }

  ** I-R14 设备利用率聚合（F-D F4.1，v0.4.0）：lib 只读聚合函数，days ∈ 7/30/90。
  ** 每台设备取其 primary point 做 hisRead 聚合；无 his 或无 dmRatedValue 的设备
  ** 返回明确空态字段（status=noHis/noRated），不伪造。
  @Axon
  static Grid dmComputeUtilization(Number daysArg) {
    days := daysArg.toInt
    if (days != 7 && days != 30 && days != 90)
      throw ArgErr("days must be 7/30/90")
    tz := TimeZone("Asia/Shanghai")
    end := DateTime.nowUtc.toTimeZone(tz).floor(1hr)
    start := end - (24hr * days)
    range := ObjRange.make(start, end)
    rows := Dict[,]
    devs := readAllFilter("dmDevice")
    devs.each |dev| {
      devRef := dev["id"] as Ref
      if (devRef == null) return
      code := (dev["dmCode"] ?: "?").toStr
      rated := dev["dmRatedValue"] as Number
      row := Str:Obj?[
        "deviceRef":  devRef,
        "deviceCode": code,
        "deviceName": (dev["dis"] ?: code).toStr,
        "module":     (dev["dmModule"] ?: "unclassified").toStr,
        "rated":      rated,
        "onRatio":    null,
        "useHours":   null,
        "loadRatio":  null,
        "peakRatio":  null,
        "samples":    null,
        "status":     rated == null ? "noRated" : "noHis",
      ]
      if (rated != null) {
        ptRef := dev["dmPrimaryPointRef"] as Ref
        if (ptRef != null) {
          his := (Grid?)AxonContext.curAxon.call("hisRead", [ptRef, range])
          n := 0; on := 0
          sum := 0f; max := 0f
          rf := rated.toFloat
          his?.each |h| {
            v := ((h["val"] ?: h["v0"]) as Number)?.toFloat
            if (v != null) {
              n += 1
              sum += v
              if (v > max) max = v
              if (v >= rf * 0.05f) on += 1
            }
          }
          if (n > 0) {
            onRatio := on.toFloat / n.toFloat
            load := (sum / n.toFloat) / rf
            peak := max / rf
            row["onRatio"]   = Number.make(onRatio)
            row["useHours"]  = Number.make(onRatio * days.toFloat * 24f)
            row["loadRatio"] = Number.make(load)
            row["peakRatio"] = Number.make(peak)
            row["samples"]   = Number.make(n.toFloat)
            row["status"] = onRatio < 0.2f ? "idle" :
                            (load > 0.9f || peak > 1.1f ? "overload" : "ok")
          }
        }
      }
      rows.add(Etc.makeDict(row))
    }
    return Etc.makeDictsGrid(null, rows)
  }

  ** I-W11 演示数据一次性成本回填（F-D F4.2/F4.3，v0.4.0）：
  ** 仅 update 带 dmSynthetic 标记的模拟记录（documented 例外，真实数据一律不动）。
  ** 工单按类型确定性成本 200~8000 元（dmWoCost）；设备按模块档位回填
  ** dmPurchaseCost（5~80 万）/ dmAnnualBenefit（1~20 万/年）/ dmRatedValue=base。
  ** 防重放：任一模拟工单已有 dmWoCost 则整体拒绝。
  @Axon
  static Dict dmBackfillSyntheticCosts() {
    wos := readAllFilter("dmWorkOrder and dmSynthetic")
    wos.each |w| {
      if (w["dmWoCost"] != null) {
        wid := (w["id"] ?: "?").toStr
        throw ArgErr("dmBackfillSyntheticCosts already applied: dmWoCost exists on " + wid)
      }
    }
    woCount := 0
    wos.each |w| {
      id := (w["id"] as Ref)?.toStr ?: ""
      type := (w["dmWoType"] ?: "maintenance").toStr
      commitUpdate(w, Etc.makeDict(Str:Obj[
        "dmWoCost": Number.make(woCostOf(id, type).toFloat),
      ]))
      woCount += 1
    }
    devCount := 0
    devs := readAllFilter("dmDevice and dmSynthetic")
    devs.each |d| {
      id := (d["id"] as Ref)?.toStr ?: ""
      module := (d["dmModule"] ?: "unclassified").toStr
      fills := Str:Obj?[:]
      if (d["dmPurchaseCost"] == null)
        fills["dmPurchaseCost"] = Number.make(purchaseCostOf(module, id))
      if (d["dmAnnualBenefit"] == null)
        fills["dmAnnualBenefit"] = Number.make(annualBenefitOf(id))
      if (d["dmRatedValue"] == null)
        fills["dmRatedValue"] = Number.make(moduleBase(module))
      if (!fills.isEmpty) {
        m := Str:Obj[:]
        fills.each |v, k| { if (v != null) m[k] = v }
        commitUpdate(d, Etc.makeDict(m))
        devCount += 1
      }
    }
    return Etc.makeDict(Str:Obj[
      "ok":          Marker.val,
      "dmWorkOrder": Number.make(woCount.toFloat),
      "dmDevice":    Number.make(devCount.toFloat),
      "ts":          DateTime.nowUtc,
      "dmCreatedBy": contextUser(),
    ])
  }

  ** I-W12 演示历史种子（F-D F4.1，v0.4.0）：48 个模拟点位 hisWrite 近 30 天逐小时
  ** 历史（昼夜/工作日节律 + 2 台闲置 + 1 台过载 storyline，确定性规则，与前端
  ** fixtures.buildDemoUtilization 同口径）。防重放：hisSize>0 的点位跳过；
  ** documented 例外：只写模拟点位。完成后点位补 his/tz 标记。
  @Axon
  static Dict dmSeedSyntheticHistory() {
    tzName := "Asia/Shanghai"
    tz := TimeZone(tzName)
    end := DateTime.nowUtc.toTimeZone(tz).floor(1hr)
    start := end - 30day
    seeded := 0; skipped := 0
    pts := readAllFilter("point and dmSynthetic")
    pts.each |p| {
      ptRef := p["id"] as Ref
      if (ptRef == null) return
      if (hisSizeOf(ptRef) > 0) { skipped += 1; return }
      equipRef := p["equipRef"] as Ref
      if (equipRef == null) { skipped += 1; return }
      equip := (Dict?)AxonContext.curAxon.call("readById", [equipRef])
      if (equip == null || equip["dmDevice"] == null) { skipped += 1; return }
      module := (equip["dmModule"] ?: "unclassified").toStr
      base := moduleBase(module)
      idx := deviceIndex(equip)
      if (idx < 0) { skipped += 1; return }
      fills := Str:Obj[:]
      if (p["his"] == null) fills["his"] = Marker.val
      if (p["tz"] == null)  fills["tz"]  = tzName
      if (!fills.isEmpty) commitUpdate(p, Etc.makeDict(fills))
      rows := Dict[,]
      720.times |k| {
        ts := start + (1hr * k)
        weekend := ts.weekday == Weekday.sat || ts.weekday == Weekday.sun
        v := synthVal(idx, base, k, ts.hour, weekend)
        rows.add(Etc.makeDict(Str:Obj[
          "ts":  ts,
          "val": Number.make(v),
        ]))
      }
      AxonContext.curAxon.call("hisWrite", [Etc.makeDictsGrid(null, rows), ptRef])
      seeded += 1
    }
    return Etc.makeDict(Str:Obj[
      "ok":      Marker.val,
      "seeded":  Number.make(seeded.toFloat),
      "skipped": Number.make(skipped.toFloat),
      "tz":      tzName,
      "ts":      DateTime.nowUtc,
      "dmCreatedBy": contextUser(),
    ])
  }

  ** FIN 5.3 的 readAll Axon 函数形参为 Expr，Fantom 侧 call("readAll",[Str])
  ** 会触发 Str→Expr 强制转换失败（ClassCastException）；改经 skyarcd Folio API。
  private static Grid readAllFilter(Str filter) {
    cx := Context.cur(false) ?:
      throw Err("readAllFilter: no skyarcd Context available")
    return cx.folio.readAll(Filter.fromStr(filter))
  }

  ** hisSize 的 Fantom 等价（FIN 5.3 无 hisSize Axon 函数）：读 hisSize 标签
  private static Int hisSizeOf(Ref ptRef) {
    cur := (Dict?)AxonContext.curAxon.call("readById", [ptRef])
    size := cur?.get("hisSize") as Number
    return size?.toInt ?: 0
  }

  ** 确定性 32 位散列（djb2），与前端 fixtures.js 的 hash32 同口径
  private static Int hash32(Str s) {
    h := 5381
    s.each |ch| { h = (h * 33 + ch).and(0xFFFFFFFF) }
    return h
  }

  ** 演示工单成本（元）：maintenance 200~799 / repair 800~2999 / retrofit 3000~7999
  private static Int woCostOf(Str id, Str type) {
    h := hash32(id)
    if (type == "repair")   return 800  + (h / 8).and(0xFFFFFFFF) % 2200
    if (type == "retrofit") return 3000 + (h / 64).and(0xFFFFFFFF) % 5000
    return 200 + h % 600
  }

  ** 模块档位：采购成本基数（万元），5~80 万区间内按设备 id 确定性浮动 ±20%
  private static Float moduleTier(Str module) {
    switch (module) {
      case "hvac":              return 40f
      case "power":             return 55f
      case "water":             return 22f
      case "lighting":          return 8f
      case "elevator":          return 45f
      case "safety":            return 14f
      case "medical-space":     return 62f
      case "medical-equipment": return 30f
      default:                  return 20f
    }
  }

  ** 模块额定参考值（利用率计算基线），与前端 MODULES[].base 一致
  private static Float moduleBase(Str module) {
    switch (module) {
      case "hvac":              return 18f
      case "power":             return 126f
      case "water":             return 4.2f
      case "lighting":          return 65f
      case "elevator":          return 32f
      case "safety":            return 46f
      case "medical-space":     return 12f
      case "medical-equipment": return 26f
      default:                  return 1f
    }
  }

  private static Float round2(Float x) {
    return (x * 100f + 0.5f).toInt.toFloat / 100f
  }

  ** 设备采购成本（万元）：tier × (0.8 + hash%41 / 100)，保留两位
  private static Float purchaseCostOf(Str module, Str id) {
    return round2(moduleTier(module) * (0.8f + (hash32(id) % 41).toFloat / 100f))
  }

  ** 设备年收益（万元/年）：1~20 确定性取值
  private static Float annualBenefitOf(Str id) {
    return (1 + hash32("ab:" + id) % 20).toFloat
  }

  ** 设备全局序号（0~47）：dmCode 前缀定模块序、后缀定机位序
  private static Int deviceIndex(Dict equip) {
    code := (equip["dmCode"] ?: "").toStr
    dash := code.indexr("-")
    if (dash == null) return -1
    num := Int.fromStr(code[dash + 1..-1], 10, false)
    if (num < 1) return -1
    mi := moduleIndex((equip["dmModule"] ?: "").toStr)
    if (mi < 0) return -1
    return mi * 6 + num - 1
  }

  private static Int moduleIndex(Str module) {
    switch (module) {
      case "hvac":              return 0
      case "power":             return 1
      case "water":             return 2
      case "lighting":          return 3
      case "elevator":          return 4
      case "safety":            return 5
      case "medical-space":     return 6
      case "medical-equipment": return 7
      default:                  return -1
    }
  }

  ** 演示历史取值规则（与前端 fixtures.buildDemoUtilization 同口径）：
  ** 闲置 = 全局序号 22/23（照明 5/6 号，开机率≈0）；过载 = 全局序号 41
  ** （手术室 6 号，负荷率≈1.06、峰值 1.15）；正常设备 7:00~23:00 运行、
  ** 夜间低位、周末日间 ×0.85；h 为样本序号（0=30 天前整点）。
  private static Float synthVal(Int idx, Float base, Int h, Int hour, Bool weekend) {
    if (idx == 22 || idx == 23) return round2(base * 0.01f)
    if (idx == 41) {
      if (h % 47 == 0) return round2(base * 1.15f)
      return round2(base * (1.02f + ((h % 8).toFloat / 8f) * 0.08f))
    }
    if (hour < 7 || hour >= 23) return round2(base * 0.02f)
    tri := ((h + idx * 3) % 16).toFloat / 16f
    v := base * (0.5f + 0.35f * tri)
    if (weekend) v = v * 0.85f
    return round2(v)
  }

  ** 受控更新：仅对给定标签做 update diff
  private static Void commitUpdate(Dict oldRec, Dict changes) {
    flags := Etc.makeDict(["update":Marker.val])
    6.times |attempt| {
      try {
        d := AxonContext.curAxon.call("diff", [oldRec, changes, flags])
        AxonContext.curAxon.call("commit", [d])
        return
      } catch (Err e) {
        if (!e.toStr.contains("ConcurrentChangeErr") || attempt == 5) throw e
        oldRec = evalReadById((oldRec["id"] as Ref) ?: throw Err("commitUpdate: oldRec missing id"))
      }
    }
  }
}

