// 启动时自检：对比服务器上最新 index.html 的构建标记，若本页面是旧构建则自动刷新一次。
// 只作用于生产构建；开发模式（vite dev）与文件协议下跳过。
export function enforceLatestBuild() {
  if (!import.meta.env.PROD) return;
  if (location.protocol === "file:") return;
  const current = typeof __UI_BUILD_ID__ !== "undefined" ? __UI_BUILD_ID__ : "";
  fetch("./index.html", { cache: "no-store" })
    .then((res) => (res.ok ? res.text() : ""))
    .then((text) => {
      const match = text.match(/dm-build:([^>\s]+)/);
      if (!match || !current || match[1] === current) return;
      if (sessionStorage.getItem("dm-reloaded-to") === match[1]) return;
      sessionStorage.setItem("dm-reloaded-to", match[1]);
      location.reload();
    })
    .catch(() => {
      /* 网络异常时保持现状，不影响使用 */
    });
}
