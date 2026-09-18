// Adapted from the source application's shared StatusBadge presentation pattern.
import { cn } from "@/lib/utils";
export const STATES = {
  running: ["运行中", "success"],
  stopped: ["已停止", "muted"],
  fault: ["故障", "danger"],
  offline: ["离线", "warning"],
  unknown: ["未知", "muted"],
  // F-A 运维工单 / 检测记录状态
  open: ["待处理", "warning"],
  inProgress: ["进行中", "muted"],
  closed: ["已关闭", "success"],
  pass: ["达标", "success"],
  // F-C 计划执行结果 / 年度考核结论
  done: ["完成", "success"],
  partial: ["部分完成", "warning"],
  missed: ["未完成", "danger"],
  "优秀": ["优秀", "success"],
  "合格": ["合格", "success"],
  "基本合格": ["基本合格", "warning"],
  "不合格": ["不合格", "danger"],
  "未制定计划": ["未制定计划", "muted"],
  fail: ["不达标", "danger"],
  fresh: ["有效", "success"],
  stale: ["陈旧", "warning"],
  critical: ["严重", "danger"],
  warning: ["预警", "warning"],
};
export default function StatusBadge({ status = "unknown" }) {
  const [label, tone] = STATES[status] || STATES.unknown;
  return (
    <span className={cn("status-badge", `status-badge--${tone}`)}>
      <span aria-hidden="true">●</span>
      {label}
    </span>
  );
}

