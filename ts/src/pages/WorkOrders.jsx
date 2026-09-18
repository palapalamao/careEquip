// F-A F1.2 运维工单页（I-R3 / I-W1 / I-W2）
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, Download, Plus, Search, Wrench, X } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { WO_TYPES, WO_STATUSES, woTypeName } from "@/data/fixtures";
import { workOrdersToCsv } from "@/data/model";
import {
  loadWorkOrders,
  createWorkOrder,
  transitWorkOrder,
} from "@/data/provider";

function download(rows) {
  const url = URL.createObjectURL(
    new Blob([workOrdersToCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "deviceManager-workorders.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function WorkOrdersPage({ mode, devices, onChanged }) {
  const [params] = useSearchParams();
  const preselected = params.get("device") || "";
  const [state, setState] = useState({ loading: true, rows: [], error: "" });
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(Boolean(preselected));
  const [form, setForm] = useState({
    deviceId: preselected,
    type: "maintenance",
    assignee: "",
    scheduled: "",
    content: "",
  });
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const reload = (signal) =>
    loadWorkOrders(mode, signal).then(
      (rows) => setState({ loading: false, rows, error: "" }),
      (error) =>
        setState({ loading: false, rows: [], error: error.message || "读取失败" }),
    );
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, rows: [], error: "" });
    reload(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  const filtered = useMemo(() => {
    const text = search.trim().toLocaleLowerCase();
    return state.rows.filter(
      (w) =>
        (!text ||
          [w.id, w.deviceCode, w.deviceName, w.assignee, w.content].some((v) =>
            String(v || "").toLocaleLowerCase().includes(text),
          )) &&
        (status === "all" || w.status === status) &&
        (type === "all" || w.type === type),
    );
  }, [state.rows, search, status, type]);
  const counts = {
    open: state.rows.filter((w) => w.status === "open").length,
    inProgress: state.rows.filter((w) => w.status === "inProgress").length,
    closed: state.rows.filter((w) => w.status === "closed").length,
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy("正在创建工单…");
    setActionError("");
    try {
      await createWorkOrder(mode, {
        ...form,
        scheduled: form.scheduled ? `${form.scheduled}:00+08:00`.replace("T", "T") : null,
      });
      setFormOpen(false);
      setForm({ deviceId: "", type: "maintenance", assignee: "", scheduled: "", content: "" });
      await reload();
      onChanged?.();
    } catch (error) {
      setActionError(error.message || "创建失败");
    } finally {
      setBusy("");
    }
  };
  const transit = async (order, target) => {
    let note = "";
    if (target === "closed") {
      note = window.prompt("执行结果（必填，写入留痕）", "") ?? "";
      if (!note.trim()) {
        setActionError("关闭工单必须填写执行结果（dmWoResult 必填）");
        return;
      }
    }
    setBusy(`正在更新 ${order.id}…`);
    setActionError("");
    try {
      await transitWorkOrder(mode, order.id, target, note);
      await reload();
      onChanged?.();
    } catch (error) {
      setActionError(error.message || "状态更新失败");
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>运维工单</h2>
        <span>运行维护留痕 · 只增不改 · 状态单向迁移</span>
      </div>
      <div className="filters">
        <label className="search-box">
          <Search size={15} />
          <input
            aria-label="搜索工单"
            placeholder="搜索单号 / 设备 / 执行人 / 内容"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="按状态筛选"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">全部状态</option>
          {WO_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}（{counts[s.id] ?? 0}）
            </option>
          ))}
        </select>
        <select
          aria-label="按类型筛选"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">全部类型</option>
          {WO_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button className="button primary" onClick={() => setFormOpen((v) => !v)}>
          <Plus size={16} />
          新建工单
        </button>
        <button
          className="button"
          disabled={!filtered.length}
          onClick={() => download(filtered)}
        >
          <Download size={16} />
          导出
        </button>
      </div>
      {actionError && (
        <p role="alert" className="action-error">
          {actionError}
        </p>
      )}
      {formOpen && (
        <form className="record-form" onSubmit={submit}>
          <div className="form-grid">
            <label>
              关联设备（必填）
              <select
                aria-label="关联设备"
                value={form.deviceId}
                onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
              >
                <option value="">请选择设备</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              工单类型
              <select
                aria-label="工单类型"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {WO_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              执行人
              <input
                aria-label="执行人"
                value={form.assignee}
                onChange={(e) => setForm({ ...form, assignee: e.target.value })}
                placeholder="如：王工"
              />
            </label>
            <label>
              计划时间
              <input
                aria-label="计划时间"
                type="datetime-local"
                value={form.scheduled}
                onChange={(e) => setForm({ ...form, scheduled: e.target.value })}
              />
            </label>
          </div>
          <label>
            工单内容（必填）
            <textarea
              aria-label="工单内容"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="描述维护/维修/改造内容"
            />
          </label>
          <div className="form-actions">
            <button className="button primary" disabled={busy || !form.deviceId || !form.content.trim()}>
              <Wrench size={15} />
              {busy || "提交工单"}
            </button>
            <button type="button" className="button" onClick={() => setFormOpen(false)}>
              <X size={15} />
              取消
            </button>
          </div>
        </form>
      )}
      {state.loading ? (
        <p role="status">正在读取工单…</p>
      ) : state.error ? (
        <p role="alert">工单读取失败:{state.error}</p>
      ) : !filtered.length ? (
        <div className="empty-state">
          <Search />
          <h3>没有匹配的工单</h3>
          <p>调整筛选条件，或新建一条工单。</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>单号</th>
                <th>设备</th>
                <th>类型</th>
                <th>状态</th>
                <th>执行人</th>
                <th>计划时间</th>
                <th>内容</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => (
                <tr key={w.id}>
                  <td className="mono">{w.id}</td>
                  <td>
                    <span>{w.deviceCode}</span>
                    <small className="cell-sub">{w.deviceName}</small>
                  </td>
                  <td>{woTypeName(w.type)}</td>
                  <td>
                    <StatusBadge status={w.status} />
                  </td>
                  <td>{w.assignee}</td>
                  <td>
                    {w.scheduled
                      ? new Date(w.scheduled).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
                      : "—"}
                  </td>
                  <td className="content-cell">{w.content}</td>
                  <td>
                    {w.status === "open" && (
                      <button className="text-button" disabled={busy} onClick={() => transit(w, "inProgress")}>
                        开始执行
                        <ChevronRight size={13} />
                      </button>
                    )}
                    {w.status === "inProgress" && (
                      <button className="text-button" disabled={busy} onClick={() => transit(w, "closed")}>
                        关闭
                        <ChevronRight size={13} />
                      </button>
                    )}
                    {w.status === "closed" && <span className="muted">已留痕</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

