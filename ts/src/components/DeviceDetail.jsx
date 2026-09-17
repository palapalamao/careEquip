import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { X, MapPin, Cpu, Activity, Clock3 } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { loadHistory } from "../data/provider";
const TrendChart = lazy(() => import("./TrendChart"));
export default function DeviceDetail({ device, onClose }) {
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
        </div>
        {tab === "points" ? (
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
        ) : (
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
        <footer className="detail-footer">
          <p>
            数据快照：
            {device.updatedAt
              ? new Date(device.updatedAt).toLocaleString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                })
              : "未知"}
          </p>
          <p>只读观察 · 不提供设备控制或告警确认</p>
        </footer>
      </div>
    </dialog>
  );
}
