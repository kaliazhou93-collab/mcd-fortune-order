import { test as nodeTest, before, after } from "node:test";
import { chromium, expect } from "@playwright/test";
import { startServer } from "../../server/index.mjs";
import { fakeMcp } from "../server/fake-mcp.mjs";

let browser;
before(async () => { browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" }); });
after(async () => { await browser?.close(); });
function test(name, run) {
  for (const width of [360, 390, 768, 1024, 1440]) nodeTest(`${width}px: ${name}`, async () => {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    try { await run({ page }, { project: { name: `w${width}` } }); }
    finally { await context.close(); }
  });
}

// Runs production HTTP server + built React, replacing only upstream MCP.
// These are contract fixtures, NOT evidence of an open-store live run.
test("real adapter: preferences → priced draw → repriced cart → quantity → reload", async ({ page }, info) => {
  const fake = fakeMcp();
  const app = await startServer({ port: 0, token: "contract-test-token", connect: fake.connect });
  const browserErrors = [];
  page.on("pageerror", error => browserErrors.push(error.message));
  try {
    await page.goto(app.origin);
    await expect(page.getByText("真实查询", { exact: true })).toBeVisible();
    await page.getByText("🌽 清爽均衡餐").click();
    await page.getByText("不想吃牛肉", { exact: true }).click();
    await page.getByText("不想喝含糖饮料", { exact: true }).click();
    await page.getByTestId("draw-button").click();
    await page.getByTestId("skip-stage").click();
    await expect(page.getByText(/整份约 444 千卡/)).toBeVisible();
    await expect(page.getByText(/当前报价 ¥28.00/)).toBeVisible();
    await expect(page.getByText(/门店实价/)).toBeVisible();
    fake.state.price = 3000;
    await page.getByTestId("eat-this").dblclick();
    await expect(page.getByRole("heading", { name: "待购清单" })).toBeVisible();
    await expect(page.getByTestId("cart-pill")).toHaveText(/1/);
    await expect(page.getByText("合计 ¥30.00", { exact: true })).toBeVisible();
    await expect(page.getByTestId("place-order")).toHaveCount(0);
    await page.getByRole("button", { name: "增加 板烧鸡腿堡套餐 数量" }).click();
    await expect(page.getByText("合计 ¥60.00", { exact: true })).toBeVisible();
    await page.screenshot({ path: `.handoff/live-cart-${info.project.name}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    fake.state.failPrice = true;
    await page.getByRole("button", { name: "增加 板烧鸡腿堡套餐 数量" }).click();
    await expect(page.getByRole("alert")).toContainText("暂时没有返回有效结果");
    await expect(page.getByTestId("cart-pill")).toHaveText(/2/);
    fake.state.failPrice = false;
    await page.getByRole("button", { name: "重新核价" }).click();
    await expect(page.getByText("合计 ¥60.00", { exact: true })).toBeVisible();
    await page.reload();
    await page.getByTestId("cart-pill").click();
    await expect(page.getByText("合计 ¥60.00", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "删除", exact: true }).click();
    await expect(page.getByText(/清单还是空的/)).toBeVisible();
    expect(fake.state.calls.some(c => /create-order|pay-order/.test(c.name))).toBe(false);
    expect(browserErrors).toEqual([]);
  } finally { await app.close(); }
});

test("closed store stays at conditions; no menu or pretend result", async ({ page }) => {
  const fake = fakeMcp(); fake.state.open = false;
  const app = await startServer({ port: 0, token: "contract-test-token", connect: fake.connect });
  try {
    await page.goto(app.origin);
    await page.getByText("🍟 今日放纵餐").click();
    await page.getByTestId("draw-button").click();
    await expect(page.getByRole("status")).toContainText("07:00–22:00");
    await expect(page.getByTestId("eat-this")).toHaveCount(0);
    expect(fake.state.calls.map(c => c.name)).toEqual(["query-nearby-stores"]);
  } finally { await app.close(); }
});

test("own token connects in memory and disconnect clears session", async ({ page }) => {
  const fake = fakeMcp();
  const app = await startServer({ port: 0, token: "", connect: fake.connect });
  try {
    await page.goto(app.origin);
    await page.getByLabel("麦当劳 MCP Token").fill("contract-test-token");
    await page.getByRole("button", { name: "连接并开始" }).click();
    await expect(page.getByText("真实查询", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("contract-test-token");
    await page.getByRole("button", { name: "断开账号并清空清单" }).click();
    await expect(page.getByLabel("麦当劳 MCP Token")).toHaveValue("");
    await page.reload();
    await expect(page.getByLabel("麦当劳 MCP Token")).toBeVisible();
  } finally { await app.close(); }
});
