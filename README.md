# 设备管理 · deviceManager

独立 FIN POD，面向医院后勤设备观察。所有代码、依赖和产物位于本目录，不导入父级应用源码，不使用原 Node/Python 服务。

## 当前功能

- FIN End User 菜单注册「设备管理」，地址 `/pod/deviceManager/res/web/dm/index.html#/overview`。
- 设备总览、设备台账、异常设备清单。
- 暖通、配电、给排水、照明、电梯、安全、医疗空间、医疗设备 8 个分类入口。
- 编码/名称/位置搜索、运行状态和楼层组合筛选、分页、带模拟来源标记的 CSV 导出。
- 设备详情、点位读数、数据质量；本地模拟模式提供固定的 24 小时趋势。
- 桌面和手机布局、键盘导航、原生模态框焦点约束、错误/空/未知状态。

这一版迁移的是设备观察工作台，并非整个 haystack code 应用所有页面。场景编辑器、完整能源页面、3D 模型和原管理/认证页面不包含在本版中。

## 运行与构建

前端技术栈保持源项目主要版本：React 19、Vite 8、React Router 7、Recharts 3；依赖由本地 package-lock 锁定。

```powershell
cd 'D:\work\yiliaohouqin\haystack code\deviceManager\ts'
npm ci
npm run dev
```

本地开发访问 http://127.0.0.1:8094，默认为本地模拟模式。

完整 POD 构建（PowerShell 7；Node 22；已安装 FIN 5.3.0.2761）：

```powershell
cd 'D:\work\yiliaohouqin\haystack code\deviceManager'
.\scripts\build.ps1
```

脚本依次安装锁定依赖、运行单元测试、生成模拟记录预览、离线解析菜单/种子 Axon、构建 Web 与 Fantom、核对包内资源哈希。输出 `output/deviceManager.pod`，不会自动复制到 FIN 安装目录、重启服务、启用扩展或写入数据。

生产资源嵌套路径预览：

```powershell
node scripts/preview.mjs
```

打开 http://127.0.0.1:8094/pod/deviceManager/res/web/dm/index.html#/overview 。该地址模拟实际 POD 路径，因此默认 FIN 模式；在右侧「数据来源」选择「本地模拟」即可查看演示。

浏览器验收：在 `ts` 内运行 `npm run test:e2e`。如果本机没有 Chromium，先运行 `npx playwright install chromium`。

## FIN 接入与菜单

参考 energyMatrix 的 BuildFinPod + skyarc.ext/skyarc.lib + finStackMobileMenu 模式：

- POD：`deviceManager`；扩展：`deviceManager`。
- 菜单函数/App ID：`dmApp`；外壳应用标识：`_deviceManager`。
- 菜单展示名称：**设备管理**，打开设备总览。
- `dmInfo()` 是只读版本信息函数。没有后台作业、自动初始化或控制接口。
- 在测试 FIN 按现场流程安装此包、启用 deviceManager 扩展；加载后再验证 End User 入口及版本。需要重启时另行执行，不把编译成功视为已经安装。

POD 路径默认选择 FIN 数据源，由 FIN End User 宿主提供项目。请从 End User 的「设备管理」入口打开；现场资源地址附加 `?project=mytest` 会返回 404，因此不要使用该独立打开方式。未找到项目时显示未配置，不回退到 sys。当前 FIN 读取表达式固定为 `readAll(dmDevice and dmSynthetic, {limit:1000})`；未提供任意表达式输入框，也不会读取原 server 的接口。

FIN 模式使用 haystack-nclient 的宿主会话支持，具体读写适配不沿用原 haystack code 的通信。读取失败会显示错误；不会伪装成功或自动改成模拟模式。用户始终可以显式选择本地模拟。

## 模拟数据

本地固定模拟集：48 台设备、144 个本地点位值、16 个由状态派生的异常、固定快照 `2026-09-09 09:30 Asia/Shanghai`。所有数值标记 Synthetic；缺失数据保留为空，设备状态与数据质量分开。

FIN 写入预览由同一数据集生成：

```powershell
node scripts/prepare-seed.mjs
```

产出 `output/seed-preview.json`、`output/seed-records.json`、`output/seed-deviceManager.axon`。

计划新增 **104 条记录**：2 个站点、6 个楼层、48 台设备和48 个主读数点。所有记录带 `dmSynthetic`、`dmDataset:"deviceManager-demo-v1"`、`dmProvenance`；引用闭合，ID 使用 `dm-demo-*` 前缀。只新增，不覆盖/删除旧数据，不修改真实点位、连接器或 navMeta。

已有同数据集时拒绝重跑；如果发生超时或不确定结果，先用只读查询核对，不能盲目再次写入。首次执行前也要核对预定 ID 是否冲突。脚本不随扩展启动运行，也不打包成可调用写函数。

FIN 模式目前读取设备记录上的 `dmValue` 主读数快照；48 个 point 记录保留归属关系供后续扩展。本版不写 curVal、不建立连接器、不写历史。FIN 模式历史页显示“暂无可用历史”，不会根据一个当前读数伪造曲线。

模拟记录必须经 FIN Expert `confirmed=false` 预览，再由用户确认对应操作。`local-mytest` 已恢复认证并成功查询项目：问题是 MCP 子进程缺少本机代理绕过设置，原有凭据正常。详见 `docs/fin-connection-diagnosis.md`。连接成功不代表数据已导入或现场菜单已验证。

## 验证边界

已验证范围与结果见 `docs/validation.md`。编译成功和离线 Axon 解析不证明现场扩展已启用，也不证明 seed 的写入效果。FIN End User 菜单实际出现和项目数据读写必须在可用测试连接下完成验收。

## 参考与来源

- 视觉配色、信息层级、状态 badge 与 cn 工具借鉴父应用 `src/index.css`、`components/shared/StatusBadge.jsx`、`lib/utils.js`。
- 设备列表/筛选/详情的功能边界参考父应用 `components/logistics/module-operations`；为隔离旧通信而独立实现 UI 数据适配。
- FIN 包装参考 `energy/energyMatrix`；没有复制其能源服务、Job、Observer 或 demo 建库逻辑。
- FIN Expert 完整证据：`b60750f5d23bb0ef5a25bf8a`（newHybridExt 构建）；`fin_doc_Developers_-_OEM_Axon_Queries_and_How_to_Axon_Queries_and_How_to_ab669c29`（Axon diff/commit 与 lib 注册说明）。它们不构成目标运行环境兼容认证。
