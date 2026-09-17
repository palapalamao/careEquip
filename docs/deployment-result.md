# FIN 现场部署结果

2026-09-09，目标 local-mytest / mytest，FIN 5.3.0.2761。

## 已完成

- 用户重启 FIN Windows 服务并启用 deviceManager；查询确认扩展记录为 1。
- 按已确认内容分三批导入 32、24、48 条模拟记录，共 104 条，没有重复启用扩展。
- 三批审计：090b62b5-b8d2-407a-ada9-c38afb392a9a、15365c59-8b9f-43ca-ae47-1e0b2e52e61b、79558774-145f-4697-95b8-e7f4538b900d。
- 导入后查询确认 104 条数据、48 台设备、48 个点位，审计：58631c40-8896-47e0-882a-916f90aadd74。
- End User launcher 的 navigationItems 中存在「设备管理」dmApp，action 指向设备总览。证据：output/fin-menu-verification.json。
- 在 End User 宿主执行入口加载动作，设备总览及台账 DOM 读取 mytest：48 台设备、16 条模拟异常、8 个系统各 6 台。证据：output/fin-inventory-verification.json。
- 安装包与 output/deviceManager.pod 的 SHA256 均为 245E11D6A13C301485E00802D2C89C96F0C3D5B9055B2EE5B52D73B8C05BC235，5 个 Web 资源哈希一致。

## 地址与验证边界

从 FIN End User 的「设备管理」入口访问，由宿主提供 finstack.projectName。不要在资源文件地址上追加 ?project=mytest：现场该查询串导致 404，去掉后资源正常加载。

timestamp 路径段可选，不是此次 404 的原因。已通过安装版 PodWeb.onService 分支核对，撤回不必要的 timestamp 改动。菜单仍使用 /pod/deviceManager/res/web/dm/index.html#/overview。

浏览器 FIN 外壳出现 invisible/non-interactive 状态，截图未完成视觉验收。已验证菜单数据注册、菜单加载动作及 iframe 内真实 FIN 数据读取，不将截图宣称为视觉验收通过。

一次不必要的重新部署在 Windows UAC 阶段取消，未复制新版或重启服务；现已不再需要。源码和输出包恢复为已安装版本。

## 后续自动部署约定

用户明确要求以后由助手连续完成安装、必要重启、启用和验收：

1. 使用 FIN Expert 注册连接，保留 NO_PROXY 本机绕过设置，检查扩展及数据状态。
2. 构建、校验资源和包身份，备份旧包。
3. 确需替换时使用 scripts/redeploy-pod.ps1，停止 FIN5、复制、校验、启动服务；该脚本不写业务数据。
4. 验证连接后，仅对未启用扩展执行 extAdd("deviceManager")，遵守 FIN Expert 预览确认流程；不能普通 commit 新增 ext 标签。
5. 按数据集和 ID 检查防止重跑，检查 Grid 的 err 元信息，不能只看外层 succeeded。
6. 验证菜单、宿主项目、资源和数据数目。

Windows 管理员权限由系统控制，UAC 取消后不反复重试；用户已完成的步骤应先核实，避免重复操作。
