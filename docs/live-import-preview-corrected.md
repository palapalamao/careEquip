# 设备管理部署：修正预览

目标仍为 local-mytest / mytest。POD 已安装；尚未启用扩展，尚未导入模拟记录。

原第一批被 FIN 拒绝：ext 为受保护标签，不能用普通 diff/commit 新增。后续只读核对确认模拟记录和扩展记录均为 0，审计 ID 为 6b6ab6ce-fc5b-43aa-b7f9-e47b5e2aa8f7。没有继续执行依赖该批的第二、第三批。

修正后的数据内容保持不变，依次新增 32、24、48 条模拟业务记录，共 104 条。第一批删除普通 ext 记录的新增，扩展改为单独调用 `extAdd("deviceManager")`。该方式已核对安装版 FIN 的 `doc/lib-skyarc/func~extAdd.html`。不会覆盖或删除原有业务数据。

第 2、3 批请求未改变，继续沿用用户已确认的内容。以下两项为变化后的预览，均被 FIN Expert 分类为 high_impact：

| 操作 | 请求 SHA256 | 预览有效期（北京时间） |
|---|---|---|
| 第一批，新增 32 条模拟记录 | 3e731de0a940f6dc195e8eb9916ee6f557fd6ae77691af05914228cb17319058 | 2026-09-09 01:15:25 |
| 启用设备管理扩展 | 5b859dfd54f84de4d6e887710113eeae7d88b1f56d1700c9e0b238aa287a1009 | 2026-09-09 01:15:28 |

数据写入请求位于 output/fin-import-1.json，扩展请求位于 output/fin-enable-extension.json。单次确认令牌不会出现在本文件。执行后需要核对记录数、扩展状态和 End User 菜单，不能以 HTTP 200 或工具外层 succeeded 单独认定业务操作成功，必须检查 Haystack Grid 的 err 元信息。
