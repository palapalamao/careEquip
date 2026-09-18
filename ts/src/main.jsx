import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { enforceLatestBuild } from "./versionCheck";

enforceLatestBuild();
class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="empty-state">
        <h1>界面加载遇到问题</h1>
        <p>请刷新页面重试；数据没有被修改。</p>
        <button onClick={() => window.location.reload()}>重新加载</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/overview" element={<App />} />
          <Route path="/devices" element={<App />} />
          <Route path="/alarms" element={<App />} />
          <Route path="/workorders" element={<App />} />
          <Route path="/inspections" element={<App />} />
          <Route path="/plans" element={<App />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);

