// F-A F1.3 定期检测记录页（I-R4 / I-W4）
import { useEffect, useMemo, useState } from "react";
import { Download, FileCheck2, Plus, Search, X } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { INSPECT_TARGETS, INSPECT_RESULTS, inspectTargetName } from "@/data/fixtures";
import { inspectionsToCsv } from "@/data/model";
import { loadInspections, createInspection } from "@/data/provider";

function download(rows) {
  const url = URL.createObjectURL(
    new Blob([inspectionsToCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "deviceManager-inspections.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function InspectionsPage({ mode, devices, onChanged }) {
  const [state, setState] = useState({ loading: true, rows: [], error: "" });
  const [target, setTarget] = useState("all");
  const [result, setResult] = useState("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    target: "drinkingWater",
    result: "pass",
    date: "",
    deviceId: "",
    note: "",
    reportUri: "",
  });
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const reload = (signal) =>
    loadInspections(mode, signal).then(
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
      (r) =>
        (!text ||
          [r.id, r.deviceCode, r.deviceName, r.note].some((v) =>
            String(v || "").toLocaleLowerCase().includes(text),
          )) &&
        (target === "all" || r.target === target) &&
        (result === "all" || r.result === result),
    );
  }, [state.rows, search, target, result]);
  const submit = async (e) => {
    e.preventDefault();
    setBusy("正在登记检测记录…");
    setActionError("");
    try {
      await createInspection(mode, form);
      setFormOpen(false);
      setForm({ target: "drinkingWater", result: "pass", date: "", deviceId: "", note: "", reportUri: "" });
      await reload();
      onChanged?.();
    } catch (error) {
      setActionError(error.message || "登记失败");
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>定期检测记录</h2>
        <span>对应标准 9.1.2 · 饮用水/医疗用水/医用气体/空调/污水等内部检测留痕</span>
      </div>
      <div className="filters">
        <label className="search-box">
          <Search size={15} />
          <input
            aria-label="搜索检测记录"
            placeholder="搜索单号 / 设备 / 说明"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select aria-label="按检测对象筛选" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="all">全部对象</option>
          {INSPECT_TARGETS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select aria-label="按结论筛选" value={result} onChange={(e) => setResult(e.target.value)}>
          <option value="all">全部结论</option>
          {INSPECT_RESULTS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button className="button primary" onClick={() => setFormOpen((v) => !v)}>
          <Plus size={16} />
          登记检测
        </button>
        <button className="button" disabled={!filtered.length} onClick={() => download(filtered)}>
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
              检测对象（必填）
              <select aria-label="检测对象" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}>
                {INSPECT_TARGETS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              结论
              <select aria-label="检测结论" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}>
                {INSPECT_RESULTS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              检测日期（必填）
              <input aria-label="检测日期" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <label>
              关联设备（可选）
              <select aria-label="关联设备" value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })}>
                <option value="">全院 / 不关联</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              报告引用（可选）
              <input aria-label="报告引用" value={form.reportUri} onChange={(e) => setForm({ ...form, reportUri: e.target.value })} placeholder="reports://… 或文件编号" />
            </label>
          </div>
          <label>
            说明
            <textarea aria-label="检测说明" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="检测项目与结论说明" />
          </label>
          <div className="form-actions">
            <button className="button primary" disabled={busy || !form.date}>
              <FileCheck2 size={15} />
              {busy || "提交记录"}
            </button>
            <button type="button" className="button" onClick={() => setFormOpen(false)}>
              <X size={15} />
              取消
            </button>
          </div>
        </form>
      )}
      {state.loading ? (
        <p role="status">正在读取检测记录…</p>
      ) : state.error ? (
        <p role="alert">检测记录读取失败：{state.error}</p>
      ) : !filtered.length ? (
        <div className="empty-state">
          <Search />
          <h3>没有匹配的检测记录</h3>
          <p>调整筛选条件，或登记一条检测记录。</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>记录号</th>
                <th>检测对象</th>
                <th>结论</th>
                <th>日期</th>
                <th>设备</th>
                <th>说明</th>
                <th>报告</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td>{inspectTargetName(r.target)}</td>
                  <td>
                    <StatusBadge status={r.result} />
                  </td>
                  <td>{r.date || "—"}</td>
                  <td>
                    <span>{r.deviceCode}</span>
                    <small className="cell-sub">{r.deviceName}</small>
                  </td>
                  <td className="content-cell">{r.note || "—"}</td>
                  <td className="mono content-cell">{r.reportUri || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

