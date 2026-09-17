import { test, expect } from "@playwright/test";
const url = "/pod/deviceManager/res/web/dm/index.html";
test("nested POD entry, inventory filtering, details, trends, export and refresh", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const oldApi = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) oldApi.push(r.url());
  });
  await page.goto(url + "#/overview");
  await expect(page.getByRole("alert")).toContainText("未识别到 FIN 项目");
  await page.getByLabel("数据来源").selectOption("demo");
  await expect(
    page.getByRole("heading", { name: "系统设备分布" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../output/deviceManager-overview.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "主要导航" })
    .getByRole("link", { name: /设备台账/ })
    .click();
  await page.getByLabel("搜索设备").fill("AHU-001");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "查看 AHU-001 详情" }).click();
  await expect(page.getByRole("dialog")).toContainText("送风温度");
  await page.getByRole("tab", { name: "历史趋势" }).click();
  await expect(page.locator(".trend-chart svg").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出台账" }).click();
  expect((await download).suggestedFilename()).toContain("synthetic");
  await page.getByRole("button", { name: "重置筛选" }).click();
  await page.getByLabel("运行状态").selectOption("offline");
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page.getByLabel("搜索设备").fill("not-found");
  await expect(
    page.getByRole("heading", { name: "没有匹配的设备" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "设备台账", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(oldApi).toEqual([]);
});
test("mobile navigation and focus stay inside detail dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url + "#/devices");
  await page.getByLabel("数据来源").selectOption("demo");
  await page.getByRole("button", { name: "打开导航" }).click();
  await page
    .getByRole("navigation", { name: "设备系统" })
    .getByRole("link", { name: /暖通空调/ })
    .click();
  await page.getByRole("button", { name: "查看 AHU-005 详情" }).click();
  await page.getByRole("tab", { name: "历史趋势" }).click();
  await expect(
    page.getByRole("heading", { name: "暂无可用历史" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "查看 AHU-005 详情" }),
  ).toBeFocused();
  const overflow = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    items: [...document.querySelectorAll("body *")]
      .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
      .map((e) => ({
        tag: e.tagName,
        cls: e.className,
        right: e.getBoundingClientRect().right,
      }))
      .slice(0, 12),
  }));
  expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(
    overflow.width,
  );
  await page.screenshot({
    path: "../output/deviceManager-mobile.png",
    fullPage: true,
  });
});
