# 模拟当前值与历史写入预览

目标：local-mytest / mytest，仅 deviceManager-demo-v1 的 48 台模拟设备和 48 个主点位。

- 为点位配置 cur、his、Shanghai 时区和 sampled 历史模式。
- 设置 48 个有效的标准 curVal 和 curStatus，并同步页面读取的 dmValue、dmQuality 和时间戳；数值按系统的基准值加平滑波动生成，包含温度、功率、压力和负载率等单位。
- 为每个点位写入执行时刻之前 24 小时的 97 个采样，间隔 15 分钟，共 4,656 条历史。生成数据始终标为 Synthetic。
- 为设备建立 dmPrimaryPointRef，详情页通过 FIN hisRead 读取历史，显示真实写入 FIN 的模拟序列。
- 不新增设备，不修改非本数据集的点位，不配置全局 demoMode，不建立连接器或控制输出。
- 属于一次性当前快照和历史补齐，不是持续模拟服务。标准 curVal 为 transient，可能随 FIN 重启清除；页面的 dmValue 快照及写入历史持久保存。
- 如果目标已有 his 或 dmTelemetrySeeded，执行前拒绝覆盖。历史写入为异步；执行后必须回读 hisSize、hisStart/hisEnd 和样本，不以提交成功代替验收。如中断或部分失败，先核对再处理，不盲目重跑。

FIN Expert 分类：high_impact。

请求 SHA256：8407c4a317dd66bf1c40f53494c6a889075691848c461fa066bad5fa17be1f31。

预览有效期：2026-09-09 02:30:07（北京时间）。请求文件：output/fin-telemetry-request.json。

已完成离线验证：9 个 Node 测试通过，Axon 语法解析通过，POD 构建通过，5 个 Web 资源哈希核对通过。新的写入尚未执行。界面新增历史读取、加载中和错误状态；拒绝跨项目或非 dm-demo 点位的历史请求。
