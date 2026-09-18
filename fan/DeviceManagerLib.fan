using axon
using haystack

const class DeviceManagerLib {
  ** Runtime identity plus guarded record writes (F-A).
  ** 写函数原则：参数校验 → 校验引用闭合 → 只增不改；
  ** 唯一允许的"改"是工单状态单向迁移与档案空缺字段补充，均留痕。
  @Axon
  static Dict dmInfo() {
    Etc.makeDict(["podName":"deviceManager", "version":DeviceManagerExt#.pod.version.toStr,
      "uiUri":"/pod/deviceManager/res/web/dm/index.html", "readOnly":false,
      "writes":"dmCreateWorkOrder/dmTransitWorkOrder/dmSaveDeviceProfile/dmCreateInspection/dmCreatePlan/dmRecordPlanExec"])
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
      changes["dmWoClosed"] = ts
      if (note != null) changes["dmWoResult"] = note
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
    ((Obj?)AxonContext.curAxon.call("readAll", [filter]) as Grid)?.each |Dict d| { dup++ }
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

  ** 受控更新：仅对给定标签做 update diff
  private static Void commitUpdate(Dict oldRec, Dict changes) {
    m := Str:Obj[:]
    oldRec.each |ov, ok| { m[ok] = ov }
    changes.each |v, k| { m[k] = v }
    newRec := Etc.makeDict(m)
    flags := Etc.makeDict(["update":Marker.val])
    d := AxonContext.curAxon.call("diff", [oldRec, newRec, flags])
    AxonContext.curAxon.call("commit", [d])
  }
}

