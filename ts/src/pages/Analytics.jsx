// F-D 数据分析与决策支持（R8 · F4.1~F4.3 · v0.4.0）
// 三 tab：设备利用率（I-R14）/ 故障趋势（I-R3 聚合）/ 效益评估（I-R1+I-R3 聚合）。
// 页面级「打印决策报告」合并三表 + 建议清单（对应 9.2.9 维护改造提效决策支持）。
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Download, Printer, RefreshCw } from "lucide-react";
import { MODULES } from "@/data/fixtures";
import {
  buildBenefitStats,
  buildFailureStats,
  benefitToCsv,
  failureStatsToCsv,
  utilizationToCsv,
} from "@/data/model";
import {
  backfillSyntheticCosts,
  loadUtilization,
  loadWorkOrders,
  seedSyntheticHistory,
} from "@/data/provider";

const TABS = [
  { id: "utilization", name: "设备利用率" },
  { id: "failure", name: "故障趋势" },
  { id: "benefit", name: "效益评估" },
];
const DAYS = [7, 30, 90];
const moduleName = (id) => MODULES.find((m) => m.id === id)?.name || id;
const utilStatusName = {
  idle: "闲置",
  overload: "过载",
  ok: "正常",
  noHis: "无历史",
  noRated: "无额定基线",
};
const flagName = { retire: "建议评估更新淘汰", watch: "关注" };
const benefitFlagName = { missing: "待补充", loss: "亏损", low: "偏低", good: "良好" };

const pct = (v) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const num = (v, d = 2) => (v == null ? "—" : v.toFixed(d));

function downloadCsv(name, content) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AnalyticsPage({ mode, devices }) {
  const [tab, setTab] = useState("utilization");
  const [days, setDays] = useState(30);
  const [util, setUtil] = useState({ loading: true, rows: [], error: "" });
  const [orders, setOrders] = useState({ loading: true, rows: [], error: "" });
  const [notice, setNotice] = useState("");

  const reloadUtil = (signal) =>
    loadUtilization(mode, days, signal).then(
      (rows) => setUtil({ loading: false, rows, error: "" }),
      (error) =>
        setUtil({ loading: false, rows: [], error: error.message || "读取失败" }),
    );
  useEffect(() => {
    const controller = new AbortController();
    setUtil({ loading: true, rows: [], error: "" });
    reloadUtil(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, days]);
  useEffect(() => {
    const controller = new AbortController();
    setOrders({ loading: true, rows: [], error: "" });
    loadWorkOrders(mode, controller.signal).then(
      (rows) => setOrders({ loading: false, rows, error: "" }),
      (error) =>
        setOrders({ loading: false, rows: [], error: error.message || "读取失败" }),
    );
    return () => controller.abort();
  }, [mode]);

  const failure = useMemo(
    () => buildFailureStats(orders.rows, devices),
    [orders.rows, devices],
  );
  const benefit = useMemo(
    () => buildBenefitStats(devices, orders.rows),
    [devices, orders.rows],
  );
  const monthlyTotals = useMemo(
    () =>
      failure.monthLabels.map((label) => ({
        label,
        count: failure.rows.reduce(
          (s, r) => s + (r.months.find((m) => m.label === label)?.count || 0),
          0,
        ),
      })),
    [failure],
  );
  const counts = {
    idle: util.rows.filter((r) => r.status === "idle").length,
    overload: util.rows.filter((r) => r.status === "overload").length,
    watch: failure.rows.filter((r) => r.flag === "watch").length,
    retire: failure.rows.filter((r) => r.flag === "retire").length,
  };
  const suggestions = [
    ...failure.rows
      .filter((r) => r.flag === "retire")
      .map(
        (r) =>
          `建议评估更新淘汰：${r.deviceCode} ${r.deviceName}（累计维修成本 ${num(r.cost / 10000)} 万，达采购价 ${num((r.cost / 10000 / (r.purchaseCost || 1)) * 100, 0)}%）`,
      ),
    ...failure.rows
      .filter((r) => r.flag === "watch")
      .map(
        (r) =>
          `关注：${r.deviceCode} ${r.deviceName}（维修 ${r.count} 次，MTTR ${
            r.mttrHours == null ? "—" : num(r.mttrHours, 1) + "h"
          }）`,
      ),
  ];

  const seedData = async () => {
    setNotice("正在写入演示历史与成本（仅模拟数据）…");
    try {
      const seed = await seedSyntheticHistory(mode);
      const fill = await backfillSyntheticCosts(mode);
      setNotice(
        mode === "demo"
          ? "演示模式数据由本地确定性规则实时生成，无需种子。"
          : `历史种子完成（写入 ${seed.seeded} 点，跳过 ${seed.skipped} 点）；` +
              `成本回填完成（工单 ${fill.workOrders} 条，设备 ${fill.devices} 台）。刷新后查看统计。`,
      );
    } catch (error) {
      setNotice(error.message || "种子/回填失败");
    }
  };

  const utilRowsSorted = useMemo(
    () =>
      [...util.rows].sort(
        (a, b) =>
          ({ idle: 0, overload: 1, ok: 2, noHis: 3, noRated: 4 }[a.status] ?? 9) -
          ({ idle: 0, overload: 1, ok: 2, noHis: 3, noRated: 4 }[b.status] ?? 9),
      ),
    [util.rows],
  );

  return (
    <>
      <section className="panel">
        <div className="panel-title">
          <h2>
            <BarChart3 size={18} /> 数据分析与决策支持
          </h2>
          <span>对应 9.2.9 维护改造提效 · 派生统计不落库</span>
        </div>
        <div className="filters no-print">
          <label>
            统计窗口
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  近 {d} 天
                </option>
              ))}
            </select>
          </label>
          <div className="page-actions" style={{ marginLeft: "auto" }}>
            <button className="button no-print" onClick={seedData}>
              写入演示数据
            </button>
            <button
              className="button no-print"
              onClick={() =>
                downloadCsv(
                  "deviceManager-utilization.csv",
                  utilizationToCsv(utilRowsSorted),
                )
              }
            >
              <Download size={15} /> 利用率 CSV
            </button>
            <button
              className="button no-print"
              onClick={() =>
                downloadCsv(
                  "deviceManager-failure-stats.csv",
                  failureStatsToCsv(failure),
                )
              }
            >
              <Download size={15} /> 故障 CSV
            </button>
            <button
              className="button no-print"
              onClick={() =>
                downloadCsv("deviceManager-benefit.csv", benefitToCsv(benefit))
              }
            >
              <Download size={15} /> 效益 CSV
            </button>
            <button className="button primary no-print" onClick={() => window.print()}>
              <Printer size={15} /> 打印决策报告
            </button>
          </div>
        </div>
        {notice && <p className="analytics-notice no-print">{notice}</p>}
        <div className="tabs no-print" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "tab active" : "tab"}
              onClick={() => setTab(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>

        {tab === "utilization" && (
          <>
            <div className="metrics">
              <div className="metric metric--warning">
                <div className="metric-top">
                  <span>闲置设备</span>
                </div>
                <div className="metric-number">
                  {counts.idle}
                  <small>台</small>
                </div>
                <p>开机率 &lt; 20%（{days} 天窗口）</p>
              </div>
              <div className="metric metric--warning">
                <div className="metric-top">
                  <span>过载设备</span>
                </div>
                <div className="metric-number">
                  {counts.overload}
                  <small>台</small>
                </div>
                <p>负荷率 &gt; 90% 或峰值 &gt; 110%</p>
              </div>
              <div className="metric">
                <div className="metric-top">
                  <span>正常设备</span>
                </div>
                <div className="metric-number">
                  {util.rows.filter((r) => r.status === "ok").length}
                  <small>台</small>
                </div>
                <p>共 {util.rows.length} 台有统计</p>
              </div>
            </div>
            {util.error && <p className="analytics-notice">{util.error}</p>}
            {util.loading ? (
              <p className="analytics-notice">正在读取利用率统计…</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>设备</th>
                      <th>系统</th>
                      <th>额定基线</th>
                      <th>开机率</th>
                      <th>使用时长</th>
                      <th>负荷率</th>
                      <th>峰值负荷</th>
                      <th>样本数</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {utilRowsSorted.map((r) => (
                      <tr key={r.deviceId}>
                        <td>
                          <strong>{r.deviceCode}</strong> {r.deviceName}
                        </td>
                        <td>{moduleName(r.module)}</td>
                        <td>{num(r.rated, 1)}</td>
                        <td>{pct(r.onRatio)}</td>
                        <td>{num(r.useHours, 1)} h</td>
                        <td>{pct(r.loadRatio)}</td>
                        <td>{pct(r.peakRatio)}</td>
                        <td>{r.samples ?? "—"}</td>
                        <td>
                          <span className={`count-pill util-${r.status}`}>
                            {utilStatusName[r.status] || r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!util.rows.length && (
                      <tr>
                        <td colSpan={9}>
                          没有统计数据：FIN 模式请先点击「写入演示数据」生成历史。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === "failure" && (
          <>
            <div className="panel-title">
              <h3>近 12 个月维修频次趋势</h3>
              <span>维修工单按月聚合（全院）</span>
            </div>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyTotals}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="count" name="维修次数" fill="#3b6ea5" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="panel-title">
              <h3>高故障设备清单</h3>
              <span>
                关注 {counts.watch} 台 · 建议评估更新淘汰 {counts.retire} 台
              </span>
            </div>
            {orders.error && <p className="analytics-notice">{orders.error}</p>}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>设备</th>
                    <th>系统</th>
                    <th>维修频次</th>
                    <th>维修成本</th>
                    <th>MTTR</th>
                    <th>标记</th>
                  </tr>
                </thead>
                <tbody>
                  {failure.rows.map((r) => (
                    <tr key={r.deviceId}>
                      <td>
                        <strong>{r.deviceCode}</strong> {r.deviceName}
                      </td>
                      <td>{moduleName(r.module)}</td>
                      <td>{r.count} 次</td>
                      <td>{num(r.cost / 10000)} 万元</td>
                      <td>{r.mttrHours == null ? "—" : `${num(r.mttrHours, 1)} h`}</td>
                      <td>
                        {r.flag ? (
                          <span className={`count-pill flag-${r.flag}`}>
                            {flagName[r.flag]}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                  {!failure.rows.length && (
                    <tr>
                      <td colSpan={6}>暂无维修工单数据。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "benefit" && (
          <>
            <div className="panel-title">
              <h3>ROI 与全生命周期成本（LCC）</h3>
              <span>能耗不计 · 缺数据显示「待补充」</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>设备</th>
                    <th>系统</th>
                    <th>采购成本</th>
                    <th>累计维修</th>
                    <th>LCC</th>
                    <th>已用年限</th>
                    <th>年收益</th>
                    <th>ROI</th>
                    <th>年均成本</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {benefit.map((r) => (
                    <tr key={r.deviceId}>
                      <td>
                        <strong>{r.deviceCode}</strong> {r.deviceName}
                      </td>
                      <td>{moduleName(r.module)}</td>
                      <td>{r.purchaseCost == null ? "待补充" : `${num(r.purchaseCost)} 万`}</td>
                      <td>{num(r.repairCostWan)} 万</td>
                      <td>{r.lcc == null ? "—" : `${num(r.lcc)} 万`}</td>
                      <td>
                        {r.years == null
                          ? r.yearsRegistered
                            ? "不足半年"
                            : "未登记"
                          : `${num(r.years, 1)} 年`}
                      </td>
                      <td>{r.annualBenefit == null ? "待补充" : `${num(r.annualBenefit)} 万`}</td>
                      <td>{r.roi == null ? "待补充" : `${num(r.roi, 1)}%`}</td>
                      <td>{r.annualCost == null ? "—" : `${num(r.annualCost)} 万`}</td>
                      <td>
                        <span className={`count-pill benefit-${r.flag}`}>
                          {benefitFlagName[r.flag]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* 打印专用：合并三表 + 建议清单 */}
      <div className="print-only">
        <h1>设备管理数据分析决策报告</h1>
        <p>
          生成时间：{new Date().toLocaleString("zh-CN")} · 统计窗口：近 {days} 天 ·
          数据来源：{mode === "demo" ? "本地模拟" : "FIN 项目"}
        </p>
        <h2>一、设备利用率（闲置 {counts.idle} 台 / 过载 {counts.overload} 台）</h2>
        <table>
          <thead>
            <tr>
              <th>设备</th>
              <th>系统</th>
              <th>开机率</th>
              <th>使用时长(h)</th>
              <th>负荷率</th>
              <th>峰值负荷</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {utilRowsSorted.map((r) => (
              <tr key={r.deviceId}>
                <td>
                  {r.deviceCode} {r.deviceName}
                </td>
                <td>{moduleName(r.module)}</td>
                <td>{pct(r.onRatio)}</td>
                <td>{num(r.useHours, 1)}</td>
                <td>{pct(r.loadRatio)}</td>
                <td>{pct(r.peakRatio)}</td>
                <td>{utilStatusName[r.status] || r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2>二、高故障设备清单</h2>
        <table>
          <thead>
            <tr>
              <th>设备</th>
              <th>维修频次</th>
              <th>维修成本(万)</th>
              <th>MTTR(h)</th>
              <th>标记</th>
            </tr>
          </thead>
          <tbody>
            {failure.rows
              .filter((r) => r.flag)
              .map((r) => (
                <tr key={r.deviceId}>
                  <td>
                    {r.deviceCode} {r.deviceName}
                  </td>
                  <td>{r.count}</td>
                  <td>{num(r.cost / 10000)}</td>
                  <td>{r.mttrHours == null ? "—" : num(r.mttrHours, 1)}</td>
                  <td>{flagName[r.flag]}</td>
                </tr>
              ))}
            {!failure.rows.some((r) => r.flag) && (
              <tr>
                <td colSpan={5}>暂无达到关注阈值的设备。</td>
              </tr>
            )}
          </tbody>
        </table>
        <h2>三、效益评估（ROI / LCC）</h2>
        <table>
          <thead>
            <tr>
              <th>设备</th>
              <th>采购成本(万)</th>
              <th>LCC(万)</th>
              <th>已用年限</th>
              <th>ROI</th>
            </tr>
          </thead>
          <tbody>
            {benefit.map((r) => (
              <tr key={r.deviceId}>
                <td>
                  {r.deviceCode} {r.deviceName}
                </td>
                <td>{r.purchaseCost == null ? "待补充" : num(r.purchaseCost)}</td>
                <td>{r.lcc == null ? "—" : num(r.lcc)}</td>
                <td>
                  {r.years == null
                    ? r.yearsRegistered
                      ? "不足半年"
                      : "未登记"
                    : num(r.years, 1)}
                </td>
                <td>{r.roi == null ? "待补充" : `${num(r.roi, 1)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2>四、建议清单</h2>
        {suggestions.length ? (
          <ul>
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        ) : (
          <p>暂无需关注的设备。</p>
        )}
      </div>
    </>
  );
}
