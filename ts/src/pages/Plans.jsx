// F-C 运行计划与执行考核页（I-R11 / I-W8；R-C.1 计划 / R-C.2 执行登记 / R-C.3 年度考核）
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronRight,
  ClipboardList,
  Download,
  Plus,
  Search,
  Wrench,
  X,
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import {
  PLAN_SYSTEMS,
  PLAN_EXEC_RESULTS,
  planSystemName,
} from "@/data/fixtures";
import {
  buildAnnualReview,
  plansToCsv,
  annualReviewToCsv,
} from "@/data/model";
import { loadPlans, createPlan, recordPlanExec, createWorkOrder } from "@/data/provider";

function downloadCsv(text, filename) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function PlansPage({ mode, devices, onChanged }) {
  const [state, setState] = useState({ loading: true, plans: [], planExecs: [], error: "" });
  const [tab, setTab] = useState("plans");
  const [system, setSystem] = useState("all");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("2026");
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [planForm, setPlanForm] = useState({ system: "hvac", period: "", content: "" });
  const [execTarget, setExecTarget] = useState(null); // 登记执行的目标计划
  const [execForm, setExecForm] = useState({ date: todayStr(), result: "done", note: "" });
  const [woTarget, setWoTarget] = useState(null); // 转工单的目标计划
  const [woForm, setWoForm] = useState({ deviceId: "", assignee: "", content: "" });
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");

  const reload = (signal) =>
    loadPlans(mode, signal).then(
      (data) => setState({ loading: false, ...data, error: "" }),
      (error) =>
        setState({ loading: false, plans: [], planExecs: [], error: error.message || "读取失败" }),
    );
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, plans: [], planExecs: [], error: "" });
    reload(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const filtered = useMemo(() => {
    const text = search.trim().toLocaleLowerCase();
    return state.plans.filter(
      (p) =>
        (system === "all" || p.system === system) &&
        (!text ||
          [p.id, p.systemName, p.period, p.content].some((v) =>
            String(v || "").toLocaleLowerCase().includes(text),
          )),
    );
  }, [state.plans, system, search]);

  const execsByPlan = useMemo(() => {
    const m = new Map();
    for (const e of state.planExecs) {
      const list = m.get(e.planId) || [];
      list.push(e);
      m.set(e.planId, list);
    }
    return m;
  }, [state.planExecs]);

  const years = useMemo(
    () => [...new Set(state.plans.map((p) => String(p.period).slice(0, 4)))].sort().reverse(),
    [state.plans],
  );
  const review = useMemo(
    () => buildAnnualReview(state.plans, state.planExecs, year),
    [state.plans, state.planExecs, year],
  );

  const submitPlan = async (e) => {
    e.preventDefault();
    setBusy("正在创建计划…");
    setActionError("");
    try {
      await createPlan(mode, planForm);
      setPlanFormOpen(false);
      setPlanForm({ system: "hvac", period: "", content: "" });
      await reload();
      onChanged?.();
    } catch (error) {
      setActionError(error.message || "创建失败");
    } finally {
      setBusy("");
    }
  };
  const openExec = (plan) => {
    setExecTarget(plan);
    setExecForm({ date: todayStr(), result: "done", note: "" });
    setWoTarget(null);
    setActionError("");
  };
  const submitExec = async (e) => {
    e.preventDefault();
    setBusy("正在登记执行…");
    setActionError("");
    try {
      await recordPlanExec(mode, { planId: execTarget.id, ...execForm });
      setExecTarget(null);
      await reload();
      onChanged?.();
    } catch (error) {
      setActionError(error.message || "登记失败");
    } finally {
      setBusy("");
    }
  };
  const openWo = (plan) => {
    const sys = PLAN_SYSTEMS.find((s) => s.id === plan.system);
    const suggested = devices.find((d) => d.module === sys?.module);
    setWoTarget(plan);
    setWoForm({
      deviceId: suggested?.id || "",
      assignee: "",
      content: `【运行计划问题】${plan.systemName} ${plan.period}：${plan.content}`,
    });
    setExecTarget(null);
    setActionError("");
  };
  const submitWo = async (e) => {
    e.preventDefault();
    setBusy("正在转工单…");
    setActionError("");
    try {
      await createWorkOrder(mode, {
        deviceId: woForm.deviceId,
        type: "repair",
        assignee: woForm.assignee,
        scheduled: null,
        content: woForm.content.trim(),
      });
      setWoTarget(null);
      onChanged?.();
    } catch (error) {
      setActionError(error.message || "转工单失败");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>运行计划</h2>
        <span>计划-执行-考核闭环 · 9.2.6 · 同系统同周期不可重复</span>
      </div>
      <div className="filters">
        <div className="tab-group" role="tablist" aria-label="运行计划视图">
          <button
            role="tab"
            aria-selected={tab === "plans"}
            className={tab === "plans" ? "tab tab--active" : "tab"}
            onClick={() => setTab("plans")}
          >
            <ClipboardList size={15} />
            计划与执行
          </button>
          <button
            role="tab"
            aria-selected={tab === "review"}
            className={tab === "review" ? "tab tab--active" : "tab"}
            onClick={() => setTab("review")}
          >
            <Calendar size={15} />
            年度考核
          </button>
        </div>
        {tab === "plans" ? (
          <>
            <label className="search-box">
              <Search size={15} />
              <input
                aria-label="搜索计划"
                placeholder="搜索计划 / 系统 / 周期 / 内容"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              aria-label="按系统筛选"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
            >
              <option value="all">全部系统</option>
              {PLAN_SYSTEMS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button className="button primary" onClick={() => setPlanFormOpen((v) => !v)}>
              <Plus size={15} />
              新建计划
            </button>
            <button
              className="button"
              onClick={() => downloadCsv(plansToCsv(filtered, state.planExecs), "deviceManager-plans.csv")}
            >
              <Download size={15} />
              导出
            </button>
          </>
        ) : (
          <>
            <select aria-label="考核年度" value={year} onChange={(e) => setYear(e.target.value)}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y} 年度
                </option>
              ))}
            </select>
            <button
              className="button"
              onClick={() => downloadCsv(annualReviewToCsv(review), `deviceManager-plan-review-${year}.csv`)}
            >
              <Download size={15} />
              导出考核汇总
            </button>
          </>
        )}
      </div>

      {actionError && <p role="alert">{actionError}</p>}

      {tab === "review" ? (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>系统</th>
                  <th>计划数(应执行)</th>
                  <th>完成</th>
                  <th>部分完成</th>
                  <th>未完成</th>
                  <th>未登记</th>
                  <th>完成率</th>
                  <th>考核结论</th>
                </tr>
              </thead>
              <tbody>
                {review.map((r) => (
                  <tr key={r.system}>
                    <td>{r.systemName}</td>
                    <td>{r.total}</td>
                    <td>{r.done}</td>
                    <td>{r.partial}</td>
                    <td>{r.missed}</td>
                    <td>{r.unregistered}</td>
                    <td>{r.completionRate == null ? "—" : `${r.completionRate}%`}</td>
                    <td>
                      <StatusBadge status={r.conclusion} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted review-note">
            考核口径：应执行=该年度该系统的计划数；未登记=无执行记录的计划；完成率=完成÷应执行。
            结论规则：≥90% 优秀，≥75% 合格，≥60% 基本合格，其余不合格；无计划显示"未制定计划"。
            结论由系统按登记数据生成，可导出存档（不写回执行记录）。
          </p>
        </>
      ) : state.loading ? (
        <p role="status">正在读取运行计划…</p>
      ) : state.error ? (
        <p role="alert">运行计划读取失败：{state.error}</p>
      ) : !filtered.length ? (
        <div className="empty-state">
          <Search />
          <h3>没有匹配的计划</h3>
          <p>调整筛选条件，或新建一条运行计划。</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>计划</th>
                <th>系统</th>
                <th>周期</th>
                <th>计划内容</th>
                <th>执行登记</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const execs = execsByPlan.get(p.id) || [];
                return (
                  <tr key={p.id}>
                    <td className="mono">{p.id}</td>
                    <td>{p.systemName}</td>
                    <td className="mono">{p.period}</td>
                    <td className="content-cell">{p.content}</td>
                    <td>
                      {execs.length ? (
                        execs.map((ex) => (
                          <div key={ex.id} className="exec-line">
                            <StatusBadge status={ex.result} />
                            <span className="mono">{ex.date}</span>
                            {ex.note && <small className="cell-sub">{ex.note}</small>}
                          </div>
                        ))
                      ) : (
                        <span className="muted">未登记</span>
                      )}
                    </td>
                    <td>
                      <button className="text-button" disabled={busy} onClick={() => openExec(p)}>
                        登记执行
                        <ChevronRight size={13} />
                      </button>
                      <button className="text-button" disabled={busy} onClick={() => openWo(p)}>
                        问题转工单
                        <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {planFormOpen && tab === "plans" && (
        <form className="inline-form" aria-label="新建运行计划" onSubmit={submitPlan}>
          <div className="form-grid">
            <label>
              系统（必填）
              <select
                aria-label="计划系统"
                value={planForm.system}
                onChange={(e) => setPlanForm({ ...planForm, system: e.target.value })}
              >
                {PLAN_SYSTEMS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              周期（必填，YYYY-MM）
              <input
                aria-label="计划周期"
                placeholder="如 2026-10"
                pattern="\d{4}-\d{2}"
                value={planForm.period}
                onChange={(e) => setPlanForm({ ...planForm, period: e.target.value })}
              />
            </label>
          </div>
          <label>
            计划内容（必填）
            <textarea
              aria-label="计划内容"
              value={planForm.content}
              onChange={(e) => setPlanForm({ ...planForm, content: e.target.value })}
              placeholder="描述本月/本年度运行管理安排"
            />
          </label>
          <div className="form-actions">
            <button className="button primary" disabled={busy || !planForm.period.trim() || !planForm.content.trim()}>
              <Plus size={15} />
              {busy || "提交计划"}
            </button>
            <button type="button" className="button" onClick={() => setPlanFormOpen(false)}>
              <X size={15} />
              取消
            </button>
          </div>
        </form>
      )}

      {execTarget && (
        <form className="inline-form" aria-label="登记执行" onSubmit={submitExec}>
          <h3>
            登记执行：{execTarget.systemName} · {execTarget.period}
          </h3>
          <div className="form-grid">
            <label>
              执行日期（必填）
              <input
                aria-label="执行日期"
                type="date"
                value={execForm.date}
                onChange={(e) => setExecForm({ ...execForm, date: e.target.value })}
              />
            </label>
            <label>
              执行结果（必填）
              <select
                aria-label="执行结果"
                value={execForm.result}
                onChange={(e) => setExecForm({ ...execForm, result: e.target.value })}
              >
                {PLAN_EXEC_RESULTS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            备注（部分完成/未完成时建议填写原因）
            <textarea
              aria-label="执行备注"
              value={execForm.note}
              onChange={(e) => setExecForm({ ...execForm, note: e.target.value })}
            />
          </label>
          <div className="form-actions">
            <button className="button primary" disabled={busy || !execForm.date}>
              <ClipboardList size={15} />
              {busy || "提交登记"}
            </button>
            <button type="button" className="button" onClick={() => setExecTarget(null)}>
              <X size={15} />
              取消
            </button>
          </div>
        </form>
      )}

      {woTarget && (
        <form className="inline-form" aria-label="问题转工单" onSubmit={submitWo}>
          <h3>
            问题转工单：{woTarget.systemName} · {woTarget.period}
          </h3>
          <div className="form-grid">
            <label>
              关联设备（必填）
              <select
                aria-label="关联设备"
                value={woForm.deviceId}
                onChange={(e) => setWoForm({ ...woForm, deviceId: e.target.value })}
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
              执行人
              <input
                aria-label="执行人"
                value={woForm.assignee}
                onChange={(e) => setWoForm({ ...woForm, assignee: e.target.value })}
                placeholder="如：王工"
              />
            </label>
          </div>
          <label>
            工单内容（必填）
            <textarea
              aria-label="工单内容"
              value={woForm.content}
              onChange={(e) => setWoForm({ ...woForm, content: e.target.value })}
            />
          </label>
          <div className="form-actions">
            <button className="button primary" disabled={busy || !woForm.deviceId || !woForm.content.trim()}>
              <Wrench size={15} />
              {busy || "转为工单"}
            </button>
            <button type="button" className="button" onClick={() => setWoTarget(null)}>
              <X size={15} />
              取消
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
