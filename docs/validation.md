# 验证记录

日期：2026-09-09。所有源代码和产物位于 deviceManager。

最终检查：8 项 Node 测试、2 项 Playwright 场景通过；完整构建及 5 个 Web 资源哈希核对通过。最终 POD SHA-256：245E11D6A13C301485E00802D2C89C96F0C3D5B9055B2EE5B52D73B8C05BC235。

## 已验证

- 使用本机 FIN 5.3.0.2761 的 BuildFinPod 完成 Fantom 与 React 的完整构建，输出 output/deviceManager.pod。
- 独立 PowerShell 检查最终 POD 必要注册文件，并逐文件核对 Web 资源 SHA-256，包含延迟加载的图表和 FIN 客户端 chunk。
- Node 测试覆盖模拟数据确定性、引用、过滤、未知值、FIN 数据映射、CSV 转义、项目上下文、种子写入范围与重跑保护。
- Playwright Chromium 在实际 /pod/deviceManager/res/web/dm/ 嵌套路径验证：未配置项目错误、显式切换模拟、列表搜索、详情、延迟图表、Esc 关闭与焦点恢复、导出、状态筛选、空状态、刷新。
- 手机 390×844 验证系统导航、缺失历史、模态框退出焦点、页面无横向溢出。桌面截图 1440 像素宽。
- FIN 本地 Axon Parser 解析 menu.trio 和 seed-deviceManager.axon；没有执行表达式。

浏览器检查中发现预览服务器目录边界计算错误和表头屏幕阅读器文字导致的手机横向溢出，均已修复并复测。

## FIN Expert 检查范围

使用 FIN Expert 搜索并读取 newHybridExt 构建和官方 Axon 说明全文，证据 ID 记录于 README。

按 FIN Expert 技能要求提交 connector 离线验证。当前验证器接受的是协议连接器设计 JSON，并非 Fantom 源码编译器：首次直接提交源文本返回 ARTIFACT_PARSE；重新提交包含完整源码及真实范围说明的对象后，仍提示 CONNECTOR_ARCHITECTURE、CONNECTOR_SECRETS、CONNECTOR_WRITE_VALIDATION、CONNECTOR_TESTS。这些规则要求协议 transport、凭据存储、点位写入和连接器生命周期测试，与本项目的只读 Web POD 不一致。没有为获得通过而增加伪造能力；此项不记为通过。目标 5.3.0.2761 也不在该验证器 evidence-scoped 版本矩阵内。

代码可编译和菜单/种子语法可解析由本地 FIN 工具链单独验证，不替代现场运行验收。

菜单 Trio 的文本检查最初提示 AXON_DO_END：该检查器要求 do 独占一行，而参考源码使用 () => do。同一段源代码也不能脱离 Trio 元信息提交给这个交付检查器。已把菜单 do 调整为独立行，完整 Trio 重新检查；实际语法仍以本机 TrioReader + Axon Parser 结果核对。

最终菜单 FIN Expert Trio 检查 passed=true、issues=[]（trace-53f37a0280334f688b42d955ef8169ec），目标版本运行兼容状态仍为 unverified。格式修改后重新通过本地解析、构建和 POD 资源核对。

## 未完成的现场步骤

- FIN Expert 注册连接 local-mytest 返回 LiveTransportError:auth_failed（trace-129973871f0342d39bf1e296f6ad3680）。
- 尚未安装/启用新扩展、重启服务或观察 End User 菜单实际出现。
- 尚未对 seed 进行 FIN Expert 可执行操作的确认和写入；104 条记录仍是本地预览。
- FIN 客户端的真实项目读取和种子的实际数据库行为尚未在线验证。
- 不声称原 haystack code 的所有页面已迁入；本版交付跨模块设备观察工作台。

## 复测命令

在 deviceManager 根目录执行 scripts/build.ps1；在 ts 目录执行 npm run test:e2e。默认构建不部署。修复 FIN 注册连接认证后，先读项目现状和预定 ID 冲突，再通过 FIN Expert 生成具体写入预览并等待确认。
