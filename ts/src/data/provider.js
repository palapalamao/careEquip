import { createDataset } from "./fixtures";
import { normalizeFinRows, normalizeHistoryRows, resolveProject } from "./model";

export function hostProject() {
  let shell;
  try {
    shell =
      window.top?.finstack?.projectName ??
      window.top?.fin5Top?.finstack?.projectName;
  } catch {
    /* Cross-origin hosts require explicit project context. */
  }
  return resolveProject({
    shell,
    query: new URLSearchParams(window.location.search).get("project"),
    dev: import.meta.env.VITE_FIN_PROJECT,
    isDev: import.meta.env.DEV,
  });
}
export async function loadDataset(mode, signal) {
  if (mode === "demo") return createDataset();
  const project = hostProject();
  if (!project)
    throw new Error(
      "未识别到 FIN 项目。请从 FIN End User 的设备管理入口打开。",
    );
  const { Client } = await import("haystack-nclient");
  signal?.throwIfAborted();
  const client = new Client({
    base: new URL(window.location.href),
    project,
    options: { headers: { accept: "text/zinc" }, signal },
  });
  const grid = await client.ext.eval(
    "readAll(dmDevice and dmSynthetic, {limit:1000})",
  );
  signal?.throwIfAborted();
  if (grid.length >= 1000)
    throw new Error(
      "模拟记录达到 1000 条读取上限，请缩小数据集后再查看，避免显示不完整汇总。",
    );
  return normalizeFinRows(grid.toJSON().rows || []);
}

export async function loadHistory(pointId, signal) {
  if (!/^p:[a-zA-Z0-9_-]+:r:dm-demo-[a-z0-9-]+$/.test(pointId))
    throw new Error("无效的模拟历史点位标识");
  const project = hostProject();
  if (!project || !pointId.startsWith(`p:${project}:r:`)) throw new Error("历史点位不属于当前项目");
  const { Client } = await import("haystack-nclient");
  signal?.throwIfAborted();
  const client = new Client({base:new URL(window.location.href),project,options:{headers:{accept:"text/zinc"},signal}});
  const grid = await client.ext.eval(`readById(@${pointId}).hisRead((now() - 24hr)..now())`);
  signal?.throwIfAborted();
  return normalizeHistoryRows(grid.toJSON().rows || []);
}
