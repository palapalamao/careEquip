# FIN Expert 本机连接诊断

2026-09-09 对照「执行 AXON 查询函数」任务，使用相同注册连接 local-mytest、项目 mytest 和已保存凭据复测。

## 原因与验证

MCP stdio 默认只继承允许列表中的环境变量，未继承 NO_PROXY。本机代理绕过设置缺失时，认证探测返回 HTTP 503；FIN Expert 的认证代码将非 401 的初始应答统一报告为 auth_failed，因此这个错误不能直接说明密码错误。

在独立 MCP 进程中仅补入 NO_PROXY=localhost,127.0.0.1,::1 后，原有凭据成功完成 SCRAM 认证；about、ops 和 Axon 查询均成功。未修改注册连接、密码、FIN 接口或认证逻辑。

实际查询结果：energyMatrix 记录 298 条；deviceManager-demo-v1 记录 0 条。审计 ID：bb7846b3-530c-40f9-a337-867b40effb89。随后 readAll(ext) 成功，确认 deviceManager 尚未启用；审计 ID：6e4a0681-02dd-462f-9f99-7a32d6fbbdb7。

## 本项目的连接方式

scripts/fin-mcp-session.py 为新启动的 FIN Expert MCP 子进程显式传入本机代理绕过设置，继续使用原注册连接、凭据存储、工具分类、确认令牌和审计。它不直接发送 FIN HTTP 请求。

此修复只作用于这个启动脚本，不会刷新当前对话已挂载的常驻 MCP 进程。其他任务可在自己的 MCP 启动环境中配置同一 NO_PROXY 设置并重启该 MCP 进程。

## 后续预防

在 FIN Expert 插件源配置的 `.mcp.json` 中，为 `mcpServers.fin-expert.env` 合并以下字段，保留原有的其他环境变量：

```json
{"NO_PROXY":"localhost,127.0.0.1,::1"}
```

当前安装缓存的 `.mcp.json` 中 env 仍为空；本项目没有修改插件全局配置。只改缓存容易被插件升级覆盖，应在插件源配置中维护，再刷新安装。生效需要重启 FIN Expert MCP 进程；无需为代理设置重启 FIN 服务。如果已有 NO_PROXY 条目，应追加本机地址并保留已有条目。

每次更新插件后，先调用 fin_live_test_connection，再执行小范围只读查询。遇到 auth_failed 时，应区分 HTTP 503 等传输错误和真实认证失败，不要直接重置密码。

对于远程 FIN，不要把 NO_PROXY 设为星号。仅在确认需要直接访问时加入已注册 FIN 的确切主机名。

连接恢复不等于部署完成。POD 安装、项目扩展启用、模拟数据导入及 End User 菜单仍需分别验证。
