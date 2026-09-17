import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
export default function TrendChart({ data, unit }) {
  return (
    <div className="trend-chart" aria-label="24小时模拟趋势">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#009999" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#009999" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 4"
            vertical={false}
            stroke="#dce7e9"
          />
          <XAxis
            dataKey="ts"
            tickFormatter={(v) =>
              new Date(v).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Shanghai",
              })
            }
            minTickGap={48}
            tick={{ fontSize: 11 }}
          />
          <YAxis width={50} tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
          <Tooltip
            labelFormatter={(v) =>
              new Date(v).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
            }
            formatter={(v) => [`${v} ${unit}`, "模拟读数"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#008b8b"
            strokeWidth={2}
            fill="url(#trendFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
