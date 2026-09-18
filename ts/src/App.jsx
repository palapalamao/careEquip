import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Box,
  Building2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ClipboardList,
  Cpu,
  Download,
  Fan,
  FlaskConical,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  WifiOff,
  X,
  Zap,
  Droplets,
  Lightbulb,
  HeartPulse,
  Wrench,
  FileCheck2,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULES } from "@/data/fixtures";
import { filterDevices, summarize, toCsv } from "@/data/model";
import { hostProject, loadDataset } from "@/data/provider";
import StatusBadge from "@/components/StatusBadge";
import DeviceDetail from "@/components/DeviceDetail";
import WorkOrdersPage from "@/pages/WorkOrders";
import InspectionsPage from "@/pages/Inspections";
import PlansPage from "@/pages/Plans";
const ICONS = {
  hvac: Fan,
  power: Zap,
  water: Droplets,
  lighting: Lightbulb,
  elevator: Layers,
  safety: ShieldCheck,
  "medical-space": Building2,
  "medical-equipment": HeartPulse,
};
const PAGE_NAMES = {
  overview: "设备总览",
  devices: "设备台账",
  alarms: "异常设备",
  workorders: "运维工单",
  inspections: "检测记录",
  plans: "运行计划",
};
const initialMode = () =>
  new URLSearchParams(window.location.search).get("mode") === "demo"
    ? "demo"
    : window.location.pathname.startsWith("/pod/") ? "fin" : "demo";

function Metric({ label, value, detail, icon: Icon, tone }) {
  return (
    <div className={cn("metric", tone && `metric--${tone}`)}>
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={19} />
      </div>
      <div className="metric-number">
        {value}
        <small>台</small>
      </div>
      <p>{detail}</p>
    </div>
  );
}
function downloadDevices(rows) {
  const url = URL.createObjectURL(
    new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "deviceManager-synthetic-devices.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const location = useLocation(),
    navigate = useNavigate();
  const page = location.pathname.split("/")[1] || "overview";
  const params = new URLSearchParams(location.search);
  const module = params.get("module") || "all";
  const [mode, setMode] = useState(initialMode),
    [revision, setRevision] = useState(0),
    [state, setState] = useState({ loading: true, data: null, error: "" });
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [floor, setFloor] = useState("all"),
    [pageIndex, setPageIndex] = useState(0),
    [selected, setSelected] = useState(null),
    [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState({ loading: true, data: null, error: "" });
    setSelected(null);
    loadDataset(mode, controller.signal)
      .then((data) => {
        if (!cancelled) setState({ loading: false, data, error: "" });
      })
      .catch((error) => {
        if (!cancelled)
          setState({
            loading: false,
            data: null,
            error: error.message || "读取失败",
          });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mode, revision]);
  useEffect(() => {
    document.title = `${PAGE_NAMES[page] || "设备管理"} · 设备管理`;
    setNavOpen(false);
    setPageIndex(0);
    setSelected(null);
  }, [location.key, page]);
  const devices = state.data?.devices || [];
  const stats = summarize(devices);
  const filtered = useMemo(
    () => filterDevices(devices, { search, module, status, floor }),
    [devices, search, module, status, floor],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10)),
    currentPage = Math.min(pageIndex, pages - 1);
  const visible = filtered.slice(currentPage * 10, currentPage * 10 + 10);
  const floors = [...new Set(devices.map((d) => d.floor))].sort();
  const project = hostProject();
  const updateFilter = (setter, value) => {
    setter(value);
    setPageIndex(0);
  };
  const selectedModule = MODULES.find((m) => m.id === module);
  return (
    <div className="app-shell">
      <button
        className="skip-link"
        onClick={() => document.getElementById("main-content")?.focus()}
      >
        跳到主内容
      </button>
      {navOpen && (
        <button
          className="nav-backdrop"
          aria-label="关闭导航"
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside className={cn("sidebar", navOpen && "sidebar--open")}>
        <div className="brand">
          <div className="brand-mark">
            <Box size={27} />
          </div>
          <div>
            <strong>设备管理</strong>
            <span>医院后勤运营中心</span>
          </div>
          <button
            className="mobile-close"
            aria-label="关闭侧栏"
            onClick={() => setNavOpen(false)}
          >
            <X />
          </button>
        </div>
        <div className="sidebar-section">工作空间</div>
        <nav aria-label="主要导航">
          <NavLink to="/overview">
            <LayoutDashboard size={18} />
            设备总览
          </NavLink>
          <NavLink to="/devices">
            <ClipboardList size={18} />
            设备台账<span className="nav-count">{devices.length || "—"}</span>
          </NavLink>
          <NavLink to="/alarms">
            <Bell size={18} />
            异常设备
            {state.data && (
              <span className="nav-count warning-count">
                {state.data.alarms.length}
              </span>
            )}
          </NavLink>
        </nav>
        <div className="sidebar-section">运行管理</div>
        <nav aria-label="运行管理">
          <NavLink to="/workorders">
            <Wrench size={18} />
            运维工单
          </NavLink>
          <NavLink to="/inspections">
            <FileCheck2 size={18} />
            检测记录
          </NavLink>
          <NavLink to="/plans">
            <Calendar size={18} />
            运行计划
          </NavLink>
        </nav>
        <div className="sidebar-section">设备系统</div>
        <nav aria-label="设备系统">
          {MODULES.map((m) => {
            const Icon = ICONS[m.id];
            return (
              <NavLink
                key={m.id}
                to={`/devices?module=${m.id}`}
                className={() =>
                  cn(module === m.id && page === "devices" && "active")
                }
              >
                <Icon size={17} />
                {m.name}
                <span className="nav-count">
                  {devices.filter((d) => d.module === m.id).length || "—"}
                </span>
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div>
            <ShieldCheck size={16} />
            只读设备观察
          </div>
          <p>
            deviceManager <span>UI v{__UI_VERSION__}</span>
          </p>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            aria-label="打开导航"
            className="icon-button mobile-toggle"
            onClick={() => setNavOpen(true)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            <Building2 size={17} />
            <span>医院后勤</span>
            <ChevronRight size={14} />
            <strong>{PAGE_NAMES[page]}</strong>
          </div>
          <div className="topbar-right">
            <span className="project-name">
              {mode === "fin" ? project || "项目未配置" : "演示院区"}
            </span>
            <span className="readonly">
              <ShieldCheck size={14} />
              只读
            </span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="page-kicker">设备管理工作台</div>
              <h1>
                {page === "devices" && selectedModule
                  ? selectedModule.name
                  : PAGE_NAMES[page]}
              </h1>
              <p>集中查看设备、运行状态与数据质量，追溯每一项异常。</p>
            </div>
            <div className="page-actions">
              <button
                className="button"
                onClick={() => setRevision((v) => v + 1)}
                disabled={state.loading}
              >
                <RefreshCw size={16} className={cn(state.loading && "spin")} />
                刷新
              </button>
              <button
                className="button primary"
                disabled={!filtered.length}
                onClick={() => downloadDevices(filtered)}
              >
                <Download size={16} />
                导出台账
              </button>
            </div>
          </div>
          <div className="data-rail">
            <div>
              <FlaskConical size={18} />
              <strong>
                {mode === "demo" ? "本地模拟数据" : "FIN 项目模拟数据"}
              </strong>
              <span>
                {mode === "demo"
                  ? "Synthetic · 固定演示快照，不用于实际运维决策"
                  : "仅查看 dmDevice + dmSynthetic 标记记录"}
              </span>
            </div>
            <label>
              数据来源
              <select
                aria-label="数据来源"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="demo">本地模拟</option>
                <option value="fin">FIN 项目</option>
              </select>
            </label>
          </div>
          {state.loading ? (
            <div className="empty-state panel" role="status">
              <RefreshCw className="spin" />
              <h2>正在加载设备数据</h2>
            </div>
          ) : state.error ? (
            <div className="empty-state panel" role="alert">
              <WifiOff />
              <h2>暂时无法读取 FIN 项目</h2>
              <p>{state.error}</p>
              <button
                className="button"
                onClick={() => setRevision((v) => v + 1)}
              >
                重试读取
              </button>
            </div>
          ) : (
            <>
              <section className="metrics" aria-label="设备指标">
                <Metric
                  label="设备总数"
                  value={stats.total}
                  detail={`${MODULES.filter((m) => devices.some((d) => d.module === m.id)).length} 个设备系统`}
                  icon={Cpu}
                />
                <Metric
                  label="运行中"
                  value={stats.running}
                  detail="依据运行反馈状态"
                  icon={Activity}
                  tone="success"
                />
                <Metric
                  label="需要关注"
                  value={stats.attention}
                  detail="故障与通信离线设备"
                  icon={Bell}
                  tone="warning"
                />
                <Metric
                  label="状态未知"
                  value={stats.unknown}
                  detail="未配置或缺少有效反馈"
                  icon={Server}
                />
              </section>
              {page === "overview" ? (
                <>
                  <section className="overview-grid">
                    <div className="panel">
                      <div className="panel-title">
                        <h2>系统设备分布</h2>
                        <span>按设备所属系统</span>
                      </div>
                      <div className="module-grid">
                        {MODULES.map((m) => {
                          const list = devices.filter((d) => d.module === m.id),
                            summary = summarize(list),
                            Icon = ICONS[m.id];
                          return (
                            <button
                              key={m.id}
                              className="module-card"
                              onClick={() =>
                                navigate(`/devices?module=${m.id}`)
                              }
                            >
                              <div className="module-card-top">
                                <Icon size={22} />
                                <ArrowUpRight size={16} />
                              </div>
                              <h3>{m.name}</h3>
                              <div className="module-total">
                                {list.length}
                                <small>台设备</small>
                              </div>
                              <div className="health-bar">
                                <span
                                  style={{
                                    width: `${list.length ? (summary.healthy / list.length) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                              <p>
                                {summary.attention} 台需关注{" "}
                                <span>{summary.unknown} 台未知</span>
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="panel attention-panel">
                      <div className="panel-title">
                        <h2>关注清单</h2>
                        <button
                          className="text-button"
                          onClick={() => navigate("/alarms")}
                        >
                          查看全部
                        </button>
                      </div>
                      {state.data.alarms.slice(0, 6).map((a) => (
                        <button
                          className="attention-item"
                          key={a.id}
                          onClick={() =>
                            setSelected(
                              devices.find((d) => d.id === a.deviceId),
                            )
                          }
                        >
                          <span
                            className={cn(
                              "alarm-dot",
                              a.severity === "critical" && "critical",
                            )}
                          />
                          <div>
                            <strong>{a.name}</strong>
                            <p>{a.message}</p>
                            <small>{a.code}</small>
                          </div>
                          <ChevronRight size={15} />
                        </button>
                      ))}
                      {!state.data.alarms.length && (
                        <p className="empty-note">
                          当前数据集没有异常设备记录。
                        </p>
                      )}
                    </div>
                  </section>
                </>
              ) : page === "devices" ? (
                <section className="panel inventory">
                  <div className="panel-title">
                    <h2>
                      设备台账{" "}
                      <span className="count-pill">{filtered.length}</span>
                    </h2>
                    <span>点选设备查看点位与趋势</span>
                  </div>
                  <div className="filters">
                    <label className="search-box">
                      <Search size={17} />
                      <input
                        aria-label="搜索设备"
                        placeholder="搜索设备名称、编码或位置"
                        value={search}
                        onChange={(e) =>
                          updateFilter(setSearch, e.target.value)
                        }
                      />
                    </label>
                    <label>
                      <SlidersHorizontal size={16} />
                      <select
                        aria-label="运行状态"
                        value={status}
                        onChange={(e) =>
                          updateFilter(setStatus, e.target.value)
                        }
                      >
                        <option value="all">全部状态</option>
                        <option value="running">运行中</option>
                        <option value="stopped">已停止</option>
                        <option value="fault">故障</option>
                        <option value="offline">离线</option>
                        <option value="unknown">未知</option>
                      </select>
                    </label>
                    <label>
                      <select
                        aria-label="楼层"
                        value={floor}
                        onChange={(e) => updateFilter(setFloor, e.target.value)}
                      >
                        <option value="all">全部楼层</option>
                        {floors.map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="text-button"
                      onClick={() => {
                        setSearch("");
                        setStatus("all");
                        setFloor("all");
                        setPageIndex(0);
                        navigate("/devices");
                      }}
                    >
                      重置筛选
                    </button>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>设备名称 / 编码</th>
                          <th>所属系统</th>
                          <th>位置</th>
                          <th>运行状态</th>
                          <th>数据质量</th>
                          <th>主要读数</th>
                          <th>
                            <span className="sr-only">操作</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((d) => {
                          const Icon = ICONS[d.module] || Cpu;
                          return (
                            <tr key={d.id}>
                              <td>
                                <button
                                  className="device-name"
                                  onClick={() => setSelected(d)}
                                >
                                  <span className="device-icon">
                                    <Icon size={18} />
                                  </span>
                                  <span>
                                    <strong>{d.name}</strong>
                                    <small>{d.code}</small>
                                  </span>
                                </button>
                              </td>
                              <td>
                                {MODULES.find((m) => m.id === d.module)?.name ||
                                  d.module}
                              </td>
                              <td>
                                <span>{d.site}</span>
                                <small className="cell-sub">{d.floor}</small>
                              </td>
                              <td>
                                <StatusBadge status={d.status} />
                              </td>
                              <td>
                                <StatusBadge status={d.quality} />
                              </td>
                              <td className="reading">
                                {d.points[0].value ?? "—"}{" "}
                                <small>{d.points[0].unit}</small>
                              </td>
                              <td>
                                <button
                                  className="text-button"
                                  aria-label={`查看 ${d.code} 详情`}
                                  onClick={() => setSelected(d)}
                                >
                                  详情
                                  <ChevronRight size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!filtered.length && (
                    <div className="empty-state">
                      <Search />
                      <h3>没有匹配的设备</h3>
                      <p>调整筛选条件，或切换至本地模拟数据检查界面。</p>
                    </div>
                  )}
                  <div className="pagination">
                    <span>
                      共 {filtered.length} 台设备 · Synthetic 模拟记录
                    </span>
                    <div>
                      <button
                        aria-label="上一页"
                        className="icon-button"
                        disabled={!currentPage}
                        onClick={() => setPageIndex(currentPage - 1)}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span>
                        {currentPage + 1} / {pages}
                      </span>
                      <button
                        aria-label="下一页"
                        className="icon-button"
                        disabled={currentPage >= pages - 1}
                        onClick={() => setPageIndex(currentPage + 1)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </section>
              ) : page === "workorders" ? (
                <WorkOrdersPage
                  mode={mode}
                  devices={devices}
                  onChanged={() => setRevision((v) => v + 1)}
                />
              ) : page === "inspections" ? (
                <InspectionsPage
                  mode={mode}
                  devices={devices}
                  onChanged={() => setRevision((v) => v + 1)}
                />
              ) : page === "plans" ? (
                <PlansPage
                  mode={mode}
                  devices={devices}
                  onChanged={() => setRevision((v) => v + 1)}
                />
              ) : (
                <section className="panel">
                  <div className="panel-title">
                    <h2>异常设备清单</h2>
                    <span>由模拟设备状态派生 · 非 FIN 原生告警</span>
                  </div>
                  <div className="alarm-list">
                    {state.data.alarms.map((a) => (
                      <button
                        key={a.id}
                        className="alarm-row"
                        onClick={() =>
                          setSelected(devices.find((d) => d.id === a.deviceId))
                        }
                      >
                        <StatusBadge status={a.severity} />
                        <div>
                          <strong>{a.name}</strong>
                          <p>{a.message}</p>
                        </div>
                        <span className="mono">{a.code}</span>
                        <ChevronRight size={17} />
                      </button>
                    ))}
                    {!state.data.alarms.length && (
                      <div className="empty-state">
                        <ShieldCheck />
                        <h3>当前没有异常设备记录</h3>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>设备管理 · 观察与决策支持</span>
            <span>
              {mode === "demo"
                ? "模拟快照 2026-09-09 09:30 · Asia/Shanghai"
                : "FIN 项目数据 · 手动刷新"}
            </span>
          </footer>
        </main>
      </div>
      {selected && (
        <DeviceDetail
          key={selected.id}
          device={selected}
          mode={mode}
          docs={state.data?.docs || []}
          onChanged={() => setRevision((v) => v + 1)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}


