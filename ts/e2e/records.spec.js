import { test, expect } from "@playwright/test";
// F-A：运维证据链 e2e（I-R2/I-R3/I-R4 读取，I-W1/I-W2/I-W4 写入，demo 模式）
const url = "/pod/deviceManager/res/web/dm/index.html";

test("work orders: create, single-direction transitions, filters and export", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url + "#/workorders");
  await expect(page.getByRole("alert")).toContainText("未识别到 FIN 项目");
  await page.getByLabel("数据来源").selectOption("demo");
  await expect(page.locator("h2", { hasText: "运维工单" })).toBeVisible();
  await expect(page.locator("tbody tr").first()).toBeVisible();

  await page.getByRole("button", { name: "新建工单" }).click();
  await page.locator("form").getByLabel("关联设备").selectOption("dm-demo-ahu-001");
  await page.locator("form").getByLabel("工单内容").fill("E2E：风机皮带检查");
  await page.getByRole("button", { name: "提交工单" }).click();
  const row = page.locator("tr", { hasText: "E2E：风机皮带检查" });
  await expect(row).toBeVisible();

  // I-W2：open→inProgress→closed 单向；closed 后不再显示操作按钮
  await row.getByRole("button", { name: "开始执行" }).click();
  await expect(row.locator(".status-badge")).toContainText("进行中");
  page.once("dialog", (d) => d.accept("E2E 关闭说明"));
  await row.getByRole("button", { name: "关闭" }).click();
  await expect(row.locator(".status-badge")).toContainText("已关闭");
  await expect(row.getByRole("button")).toHaveCount(0);

  await page.getByLabel("按状态筛选").selectOption("closed");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出", exact: true }).click();
  expect((await download).suggestedFilename()).toContain("workorders");
  expect(errors).toEqual([]);
});

test("inspections: register record with target, result and provenance", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url + "#/inspections");
  await page.getByLabel("数据来源").selectOption("demo");
  await expect(page.locator("h2", { hasText: "定期检测记录" })).toBeVisible();

  await page.getByRole("button", { name: "登记检测" }).click();
  await page.locator("form").getByLabel("检测日期").fill("2026-09-18");
  await page.locator("form").getByLabel("检测对象").selectOption("medicalGas");
  await page.locator("form").getByLabel("检测结论").selectOption("pass");
  await page.locator("form").getByLabel("检测说明").fill("E2E：医用气体纯度复检");
  await page.getByRole("button", { name: "提交记录" }).click();
  const row = page.locator("tr", { hasText: "E2E：医用气体纯度复检" });
  await expect(row).toBeVisible();
  await expect(row.locator(".status-badge")).toContainText("达标");
  expect(errors).toEqual([]);
});

test("device detail: archive fields and maintenance timeline", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url + "#/devices");
  await page.getByLabel("数据来源").selectOption("demo");
  await page.getByLabel("搜索设备").fill("AHU-001");
  await page.getByRole("button", { name: "查看 AHU-001 详情" }).click();

  await page.getByRole("tab", { name: "档案" }).click();
  await expect(page.getByRole("dialog")).toContainText("验收日期");
  await expect(page.getByRole("dialog")).toContainText("2024-06-30");

  await page.getByRole("tab", { name: "运维记录" }).click();
  await expect(page.locator(".timeline li").first()).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("空调系统");
  expect(errors).toEqual([]);
});
