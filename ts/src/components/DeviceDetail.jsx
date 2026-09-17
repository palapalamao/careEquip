import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { X, MapPin, Cpu, Activity, Clock3, FileText, ClipboardList, FolderOpen, Wrench } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { loadHistory, loadDeviceRecords, saveDeviceProfile } from "../data/provider";
import { buildDeviceTimeline } from "../data/model";
const TrendChart = lazy(() => import("./TrendChart"));

function ArchiveTab({ device, docs, mode, onChanged }) {
  const doc = docs.find((d) => d.id === device.acceptanceDocId);
  const [patch, setPatch] = useState({ commissionDate: "", inServiceDate: "", acceptanceDocUri: "" });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState({ error: "", info: "" });
  const missing = {
    commissionDate: !device.commissionDate,
    inServiceDate: !device.inServiceDate,
    acceptanceDocUri: !device.acceptanceDocId,
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy("正在补充档案…");
    setMessage({ error: "", info: "" });
    try {
      await saveDeviceProfile(mode, device.id, patch);
      setMessage({ error: "", info: "档案已补充（仅允许补充空缺字段）" });
      setPatch({ commissionDate: "", inServiceDate: "", acceptanceDocUri: "" });
      onChanged?.();
    } catch (error) {
      setMessage({ error: error.message || "补充失败", info: "" });
    } finally {
      setBusy("");
    }
  };
  return (
    <section aria-label="设备档案">
      <div className="detail-metadata">
        <div>
          <span>验收日期</span>
          <strong>{device.commissionDate || "未记录"}</strong>
        </div>
        <div>
          <span>投用日期</span>
          <strong>{device.inServiceDate || "未记录"}</strong>
        </div>
        <div>
          <span>验收资料</span>
          <strong>
            {doc ? `${doc.typeName || doc.type} · ${doc.uri || "无链接"}` : "未关联"}
          </strong>
        </div>
      </div>
      {(missing.commissionDate || missing.inServiceDate || missing.acceptanceDocUri) && (
        <form className="record-form" onSubmit={submit}>
          <div className="form-grid">
            {missing.commissionDate && (
              <label>
                验收日期
                <input aria-label="验收日期" type="date" value={patch.commissionDate} onChange={(e) => setPatch({ ...patch, commissionDate: e.target.value })} />
              </label>
            )}
            {missing.inServiceDate && (
              <label>
                投用日期
                <input aria-label="投用日期" type="date" value={patch.inServiceDate} onChange={(e) => setPatch({ ...patch, inServiceDate: e.target.value })} />
              </label>
            )}
            {missing.acceptanceDocUri && (
              <label>
                验收资料引用
                <input aria-label="验收资料引用" value={patch.acceptanceDocUri} onChange={(e) => setPatch({ ...patch, acceptanceDocUri: e.target.value })} placeholder="archives://… 或文件编号" />
              </label>
            )}
          </div>
          <div className="form-actions">
            <button className="button primary" disabled={busy}>
              <FolderOpen size={15} />
              {busy || "补充档案"}
            </button>
          </div>
        </form>
      )}
      {message.error && <p role="alert" className="action-error">{message.error}</p>}
      {message.info && <p role="status" className="muted">{message.info}</p>}
    </section>
  );
}

function RecordsTab({ device, mode }) {
  const [state, setState] = useState({ loading: false, error: "", workOrders: [], inspections: [] });
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, error: "", workOrders: [], inspections: [] });
    loadDeviceRecords(mode, device.id, controller.signal).then(
      (data) => setState({ loading: false, error: "", ...data }),
      (error) => {
        if (!controller.signal.aborted)
          setState({ loading: false, error: error.message || "读取失败", workOrders: [], inspections: [] });
      },
    );
    return () => controller.abort();
  }, [mode, device.id]);
  const timeline = buildDeviceTimeline(device.id, state.workOrders, state.inspections);
  if (state.loading) return <p role="status">正在读取运维记录…</p>;
  if (state.error) return <p role="alert">运维记录读取失败：{state.error}</p>;
  if (!timeline.length)
    return (
      <div className="empty-state">
        <ClipboardList />
        <h3>暂无运维记录</h3>
        <p>该设备还没有工单或检测记录。</p>
      </div>
    );
  return (
    <ol className="timeline">
      {timeline.map((item) => (
        <li key={`${item.kind}-${item.refId}`}>
          <span className={item.kind === "workOrder" ? "timeline-dot wo" : "timeline-dot insp"} aria-hidden="true" />
          <div>
            <div className="timeline-head">
              {item.kind === "workOrder" ? <Wrench size={13} /> : <FileText size={13} />}
              <strong>{item.title}</strong>
              <StatusBadge status={item.status} />
            </div>
            <p>{item.detail || "—"}</p>
            <small className="mono">{item.refId} · {item.ts ? new Date(item.ts).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : "时间未知"}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function DeviceDetail({ device, onClose, mode = "demo", docs = [], onChanged }) {
  const dialog = useRef(null);
  const [tab, setTab] = useState("points");
  const [history, setHistory] = useState({loading:false, error:"", data:[]});
  useEffect(() => {
    if (tab !== "trend" || !device.historyPointId) return;
    const controller = new AbortController();
    setHistory({loading:true,error:"",data:[]});
    loadHistory(device.historyPointId, controller.signal).then(
      data => { if (!controller.signal.aborted) setHistory({loading:false,error:"",data}); },
      error => { if (!controller.signal.aborted) setHistory({loading:false,error:error.message,data:[]}); },
    );
    return () => controller.abort();
  }, [tab, device.historyPointId]);
  const trend = device.historyPointId ? history.data : device.trend;
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element.showModal();
    return () => {
      element.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="detail-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="detail-inner">
        <header className="detail-header">
          <div className="device-icon large">
            <Cpu size={25} />
          </div>
          <div>
            <p className="muted mono">{device.code}</p>
            <h2>{device.name}</h2>
          </div>
          <button
            aria-label="关闭设备详情"
            className="icon-button close-detail"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>
        <div className="detail-tags">
          <StatusBadge status={device.status} />
          <span className="source-tag">
            {device.source === "synthetic"
              ? "Synthetic / 模拟设备"
              : "来源未知"}
          </span>
        </div>
        <p className="location">
          <MapPin size={15} />
          {device.location}
        </p>
        <div className="detail-metadata">
          <div>
            <span>设备类型</span>
            <strong>{device.type}</strong>
          </div>
          <div>
            <span>设备型号</span>
            <strong>{device.model}</strong>
          </div>
          <div>
            <span>生产厂商</span>
            <strong>{device.manufacturer}</strong>
          </div>
          <div>
            <span>数据质量</span>
            <StatusBadge status={device.quality} />
          </div>
        </div>
        <div className="tabs" role="tablist" aria-label="设备详情标签">
          <button
            role="tab"
            aria-selected={tab === "points"}
            onClick={() => setTab("points")}
          >
            <Activity size={16} />
            当前点位
          </button>
          <button
            role="tab"
            aria-selected={tab === "trend"}
            onClick={() => setTab("trend")}
          >
            <Clock3 size={16} />
            历史趋势
          </button>
          <button
            role="tab"
            aria-selected={tab === "archive"}
            onClick={() => setTab("archive")}
          >
            <FolderOpen size={16} />
            档案
          </button>
          <button
            role="tab"
            aria-selected={tab === "records"}
            onClick={() => setTab("records")}
          >
            <ClipboardList size={16} />
            运维记录
          </button>
        </div>
        {tab === "points" && (
          <section aria-label="设备点位" className="point-list">
            {device.points.map((p) => (
              <div key={p.id}>
                <div>
                  <strong>{p.name}</strong>
                  <small>{p.id}</small>
                </div>
                <div className="point-value">
                  {p.value === null ? "—" : p.value}
                  <small>{p.unit}</small>
                </div>
                <StatusBadge status={p.quality} />
              </div>
            ))}
          </section>
        )}
        {tab === "trend" && (
          <section>
            <h3 className="section-title">{device.points[0].name} · 24 小时</h3>
            {history.loading ? <p role="status">正在读取 FIN 历史…</p> : history.error ? <p role="alert">历史读取失败：{history.error}</p> : trend.length ? (
              <Suspense fallback={<p>正在加载趋势…</p>}>
                <TrendChart data={trend} unit={device.points[0].unit} />
              </Suspense>
            ) : (
              <div className="empty-state">
                <Clock3 />
                <h3>暂无可用历史</h3>
                <p>未提供历史序列，当前读数不会被生成或填充为历史数据。</p>
              </div>
            )}
          </section>
        )}
        {tab === "archive" && (
          <ArchiveTab device={device} docs={docs} mode={mode} onChanged={onChanged} />
        )}
        {tab === "records" && <RecordsTab device={device} mode={mode} />}
        <footer className="detail-footer">
          <p>
            数据快照：
            {device.updatedAt
              ? new Date(device.updatedAt).toLocaleString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                })
              : "未知"}
          </p>
          <p>观察与运维记录留痕 · 不提供设备控制</p>
        </footer>
      </div>
    </dialog>
  );
}
